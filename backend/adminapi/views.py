from datetime import timedelta
from pathlib import Path

from django.contrib.auth import authenticate, get_user_model
from django.db.models import Count, F, Sum, Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response

from .glb_optimize import (
    DEFAULT_RATIO,
    GlbOptimizeError,
    apply_optimized_to_character,
    optimize_uploaded_bytes,
)
from .glb_preview import (
    DEFAULT_SIZE as PREVIEW_DEFAULT_SIZE,
    GlbPreviewError,
    apply_preview_to_character,
)

from courses.models import (
    Module, Lesson, Question, Answer, UserProgress, UserStats, OnboardingQuestion,
    Badge, DailyRewardTier,
)
from moneyverse.models import Character, UserCharacter
from social.campaigns import audience_push_stats, send_campaign
from social.models import NotificationCampaign
from ai.models import TutorConversation, MoneyChatSession
from .pagination import AdminPagination
from .permissions import IsAdminUserOrReadOnly
from .serializers import (
    ModuleSerializer,
    LessonSerializer,
    QuestionSerializer,
    AnswerSerializer,
    CharacterSerializer,
    BadgeAdminSerializer,
    DailyRewardTierSerializer,
    OnboardingQuestionSerializer,
    AdminUserSerializer,
    AdminStaffSerializer,
    StaffCreateSerializer,
    ChangePasswordSerializer,
    TutorConversationSerializer,
    TutorConversationDetailSerializer,
    MoneyChatSessionSerializer,
    MoneyChatSessionDetailSerializer,
    NotificationCampaignSerializer,
)

User = get_user_model()


# --- Auth -------------------------------------------------------------------

@api_view(['POST'])
@permission_classes([AllowAny])
def admin_login(request):
    """Authenticate a staff user and return a token. Non-staff are rejected."""
    email = (request.data.get('email') or '').strip().lower()
    password = request.data.get('password') or ''

    if not email or not password:
        return Response(
            {'detail': 'Email and password are required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = authenticate(request, username=email, password=password)
    if not user:
        return Response(
            {'detail': 'Invalid email or password.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not user.is_staff:
        return Response(
            {'detail': 'This account does not have control panel access.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    token, _ = Token.objects.get_or_create(user=user)
    return Response({
        'token': token.key,
        'user': _user_payload(user),
    })


def _user_payload(user):
    return {
        'id': user.id,
        'email': user.email,
        'name': user.name,
        'is_superuser': user.is_superuser,
        'must_change_password': user.must_change_password,
    }


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_me(request):
    return Response(_user_payload(request.user))


@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_logout(request):
    try:
        request.user.auth_token.delete()
    except Exception:
        pass
    return Response({'detail': 'Logged out.'})


@api_view(['POST'])
@permission_classes([IsAdminUser])
def change_password(request):
    """Let a signed-in admin set their own password.

    Clears the must_change_password flag and rotates the auth token so the
    current session stays valid while any other sessions are invalidated.
    """
    serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
    serializer.is_valid(raise_exception=True)

    user = request.user
    user.set_password(serializer.validated_data['new_password'])
    user.must_change_password = False
    user.save(update_fields=['password', 'must_change_password'])

    # Rotate the token: invalidate the old one and issue a fresh one.
    Token.objects.filter(user=user).delete()
    token = Token.objects.create(user=user)

    return Response({'detail': 'Password updated.', 'token': token.key, 'user': _user_payload(user)})


# --- Content CRUD -----------------------------------------------------------

class ModuleViewSet(viewsets.ModelViewSet):
    queryset = Module.objects.all()
    serializer_class = ModuleSerializer
    permission_classes = [IsAdminUser]


class LessonViewSet(viewsets.ModelViewSet):
    serializer_class = LessonSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        qs = Lesson.objects.all()
        module_id = self.request.query_params.get('module')
        if module_id:
            qs = qs.filter(module_id=module_id)
        return qs


class QuestionViewSet(viewsets.ModelViewSet):
    serializer_class = QuestionSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        qs = Question.objects.all().prefetch_related('answers')
        lesson_id = self.request.query_params.get('lesson')
        if lesson_id:
            qs = qs.filter(lesson_id=lesson_id)
        return qs


class AnswerViewSet(viewsets.ModelViewSet):
    serializer_class = AnswerSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        qs = Answer.objects.all()
        question_id = self.request.query_params.get('question')
        if question_id:
            qs = qs.filter(question_id=question_id)
        return qs


def _parse_optimize_flag(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in ('1', 'true', 'yes', 'on')


def _parse_ratio(value, default=DEFAULT_RATIO):
    if value is None or value == '':
        return default
    try:
        ratio = float(value)
    except (TypeError, ValueError) as exc:
        raise GlbOptimizeError('ratio must be a number between 0 and 1') from exc
    if not (0 < ratio <= 1):
        raise GlbOptimizeError('ratio must be between 0 and 1')
    return ratio


def _request_form_value(request, key, default=None):
    """Read a form field without forcing DRF to cache request.data (which freezes FILES)."""
    if hasattr(request, 'POST') and key in request.POST:
        return request.POST.get(key)
    # JSON body fallback (rare for file uploads).
    try:
        if request.content_type and 'application/json' in request.content_type:
            return request.data.get(key, default)
    except Exception:
        pass
    return default


def _clear_drf_data_cache(request):
    for attr in ('_full_data', '_data', '_files'):
        if hasattr(request, attr):
            try:
                delattr(request, attr)
            except Exception:
                pass


class CharacterViewSet(viewsets.ModelViewSet):
    queryset = Character.objects.all()
    serializer_class = CharacterSerializer
    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def _maybe_optimize_uploaded_model(self, request):
        """If optimize=true and a model_file was uploaded, replace it with the lightweight GLB."""
        if not _parse_optimize_flag(_request_form_value(request, 'optimize'), default=False):
            return None
        uploaded = request.FILES.get('model_file')
        if not uploaded:
            return None
        ratio = _parse_ratio(_request_form_value(request, 'ratio'))
        raw = uploaded.read()
        optimized, stats = optimize_uploaded_bytes(raw, ratio=ratio)
        name = Path(getattr(uploaded, 'name', 'character.glb') or 'character.glb').stem
        from django.core.files.uploadedfile import InMemoryUploadedFile
        import io
        buf = io.BytesIO(optimized)
        request.FILES['model_file'] = InMemoryUploadedFile(
            file=buf,
            field_name='model_file',
            name=f'{name}_opt.glb',
            content_type='model/gltf-binary',
            size=len(optimized),
            charset=None,
        )
        _clear_drf_data_cache(request)
        return stats

    def create(self, request, *args, **kwargs):
        try:
            opt_stats = self._maybe_optimize_uploaded_model(request)
        except GlbOptimizeError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        response = super().create(request, *args, **kwargs)
        if opt_stats is not None and isinstance(response.data, dict):
            response.data = {**response.data, 'optimize': opt_stats}
        # Auto-render a still when a model was uploaded without a preview image.
        if (
            isinstance(response.data, dict)
            and response.data.get('id')
            and not response.data.get('preview_image')
            and response.data.get('model_file')
        ):
            try:
                character = Character.objects.get(pk=response.data['id'])
                preview_stats = apply_preview_to_character(character, force=False)
                character.refresh_from_db()
                response.data = {
                    **self.get_serializer(character).data,
                    **({'optimize': opt_stats} if opt_stats is not None else {}),
                    'preview': preview_stats,
                }
            except GlbPreviewError as exc:
                # Don't fail the create — admin can hit Generate Preview later.
                if isinstance(response.data, dict):
                    response.data = {**response.data, 'preview_error': str(exc)}
        return response

    def update(self, request, *args, **kwargs):
        try:
            opt_stats = self._maybe_optimize_uploaded_model(request)
        except GlbOptimizeError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        response = super().update(request, *args, **kwargs)
        if opt_stats is not None and isinstance(response.data, dict):
            response.data = {**response.data, 'optimize': opt_stats}
        return response

    def partial_update(self, request, *args, **kwargs):
        try:
            opt_stats = self._maybe_optimize_uploaded_model(request)
        except GlbOptimizeError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        response = super().partial_update(request, *args, **kwargs)
        if opt_stats is not None and isinstance(response.data, dict):
            response.data = {**response.data, 'optimize': opt_stats}
        return response

    @action(detail=True, methods=['post'], url_path='optimize')
    def optimize(self, request, pk=None):
        """Optimize this character's current GLB and replace the model_file."""
        character = self.get_object()
        try:
            ratio = _parse_ratio(request.data.get('ratio'))
            stats = apply_optimized_to_character(character, ratio=ratio)
        except GlbOptimizeError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        character.refresh_from_db()
        data = self.get_serializer(character).data
        return Response({'character': data, 'optimize': stats})

    @action(detail=True, methods=['post'], url_path='generate-preview')
    def generate_preview(self, request, pk=None):
        """Render a PNG still from this character's GLB into preview_image."""
        character = self.get_object()
        force = str(request.data.get('force', '')).lower() in ('1', 'true', 'yes', 'on')
        try:
            size = int(request.data.get('size') or PREVIEW_DEFAULT_SIZE)
        except (TypeError, ValueError):
            size = PREVIEW_DEFAULT_SIZE
        try:
            stats = apply_preview_to_character(character, size=size, force=force)
        except GlbPreviewError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        character.refresh_from_db()
        data = self.get_serializer(character).data
        return Response({'character': data, 'preview': stats})

    @action(detail=False, methods=['post'], url_path='generate-previews')
    def generate_previews(self, request):
        """Bulk-render PNG previews for characters missing one (or all if force)."""
        force = str(request.data.get('force', '')).lower() in ('1', 'true', 'yes', 'on')
        try:
            size = int(request.data.get('size') or PREVIEW_DEFAULT_SIZE)
        except (TypeError, ValueError):
            size = PREVIEW_DEFAULT_SIZE

        qs = Character.objects.exclude(model_file='').exclude(model_file=None).order_by('order', 'id')
        if not force:
            qs = qs.filter(Q(preview_image='') | Q(preview_image=None))

        results = []
        ok = 0
        skipped = 0
        failed = 0
        for character in qs:
            try:
                stats = apply_preview_to_character(character, size=size, force=force)
                if stats.get('skipped'):
                    skipped += 1
                else:
                    ok += 1
                results.append({'id': character.id, 'name': character.name, 'ok': True, **stats})
            except GlbPreviewError as exc:
                failed += 1
                results.append({
                    'id': character.id,
                    'name': character.name,
                    'ok': False,
                    'error': str(exc),
                })

        return Response({
            'ok': ok,
            'skipped': skipped,
            'failed': failed,
            'total': len(results),
            'results': results,
        })


@api_view(['POST'])
@permission_classes([IsAdminUser])
def optimize_glb_upload(request):
    """
    Upload a raw .glb and get back a cleaned lightweight version.

    Multipart fields:
      - file / model_file: the source GLB (required)
      - ratio: simplify ratio 0–1 (default 0.35)
      - download: if true, return the binary GLB instead of JSON metadata
    """
    uploaded = request.FILES.get('file') or request.FILES.get('model_file')
    if not uploaded:
        return Response({'detail': 'Upload a .glb as "file" or "model_file".'}, status=400)

    name = (getattr(uploaded, 'name', '') or 'model.glb').lower()
    if not name.endswith(('.glb', '.gltf')):
        return Response({'detail': 'Only .glb / .gltf files are supported.'}, status=400)

    try:
        ratio = _parse_ratio(_request_form_value(request, 'ratio') or request.data.get('ratio'))
        optimized, stats = optimize_uploaded_bytes(uploaded.read(), ratio=ratio)
    except GlbOptimizeError as exc:
        return Response({'detail': str(exc)}, status=400)

    if _parse_optimize_flag(
        _request_form_value(request, 'download') or request.data.get('download'),
        default=False,
    ):
        stem = Path(getattr(uploaded, 'name', 'model.glb')).stem or 'model'
        response = HttpResponse(optimized, content_type='model/gltf-binary')
        response['Content-Disposition'] = f'attachment; filename="{stem}_opt.glb"'
        response['X-Optimize-Bytes-Before'] = str(stats.get('bytesBefore', ''))
        response['X-Optimize-Bytes-After'] = str(stats.get('bytesAfter', ''))
        response['X-Optimize-Saved-Pct'] = str(stats.get('savedPct', ''))
        return response

    return Response({
        'optimize': stats,
        'filename': f"{Path(getattr(uploaded, 'name', 'model.glb')).stem or 'model'}_opt.glb",
    })


class BadgeViewSet(viewsets.ModelViewSet):
    queryset = Badge.objects.select_related('module').all()
    serializer_class = BadgeAdminSerializer
    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]


class DailyRewardTierViewSet(viewsets.ModelViewSet):
    queryset = DailyRewardTier.objects.all()
    serializer_class = DailyRewardTierSerializer
    permission_classes = [IsAdminUser]


class OnboardingQuestionViewSet(viewsets.ModelViewSet):
    queryset = OnboardingQuestion.objects.all().prefetch_related('options')
    serializer_class = OnboardingQuestionSerializer
    permission_classes = [IsAdminUser]


# --- User management --------------------------------------------------------

class UserViewSet(viewsets.ModelViewSet):
    serializer_class = AdminUserSerializer
    permission_classes = [IsAdminUser]
    pagination_class = AdminPagination
    http_method_names = ['get', 'patch', 'post', 'head', 'options']

    def get_queryset(self):
        qs = (
            User.objects.all()
            .select_related('stats')
            .annotate(_lessons_completed=Count('lesson_progress', distinct=True))
            .order_by('-date_joined')
        )
        search = (self.request.query_params.get('search') or '').strip()
        if search:
            qs = qs.filter(Q(email__icontains=search) | Q(name__icontains=search))
        staff = self.request.query_params.get('staff')
        if staff == 'true':
            qs = qs.filter(is_staff=True)
        elif staff == 'false':
            qs = qs.filter(is_staff=False)
        return qs

    @action(detail=True, methods=['post'])
    def adjust_stats(self, request, pk=None):
        """Set XP and/or Bot Bucks for a user. Accepts {xp, bot_bucks}."""
        user = self.get_object()
        stats, _ = UserStats.objects.get_or_create(user=user)

        xp = request.data.get('xp')
        bot_bucks = request.data.get('bot_bucks')
        if xp is not None:
            stats.xp = max(0, int(xp))
        if bot_bucks is not None:
            stats.bot_bucks = max(0, int(bot_bucks))
        stats.save()
        return Response(AdminUserSerializer(user).data)

    @action(detail=True, methods=['post'])
    def reset_progress(self, request, pk=None):
        """Wipe a user's lesson progress and gamification stats."""
        user = self.get_object()
        UserProgress.objects.filter(user=user).delete()
        stats, _ = UserStats.objects.get_or_create(user=user)
        stats.xp = 0
        stats.streak_days = 0
        stats.badges = []
        stats.bot_bucks = 0
        stats.onboarding_completed = False
        stats.onboarding_score = 0
        stats.onboarding_answers = {}
        stats.save()
        return Response(AdminUserSerializer(user).data)


# --- Staff / admin access control -------------------------------------------

class StaffViewSet(viewsets.ModelViewSet):
    """Manage who can sign in to the control panel (is_staff users)."""
    serializer_class = AdminStaffSerializer
    permission_classes = [IsAdminUserOrReadOnly]
    pagination_class = AdminPagination
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_queryset(self):
        qs = User.objects.filter(is_staff=True).order_by('-date_joined')
        search = (self.request.query_params.get('search') or '').strip()
        if search:
            qs = qs.filter(Q(email__icontains=search) | Q(name__icontains=search))
        return qs

    def create(self, request, *args, **kwargs):
        ser = StaffCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        email = ser.validated_data['email']
        password = (ser.validated_data.get('password') or '').strip()
        name = ser.validated_data.get('name') or ''

        user = User.objects.filter(email=email).first()
        if user:
            if user.is_staff:
                return Response(
                    {'detail': 'This user already has control panel access.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user.is_staff = True
            if name:
                user.name = name
            if password:
                # Password chosen by another admin; require them to set their own.
                user.set_password(password)
                user.must_change_password = True
            user.save()
        else:
            if not password:
                return Response(
                    {'detail': 'Password is required when creating a new admin account.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user = User.objects.create_user(
                email=email,
                password=password,
                name=name,
                is_staff=True,
                must_change_password=True,
            )

        return Response(AdminStaffSerializer(user).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        user = self.get_object()
        if user.id == request.user.id and request.data.get('is_staff') is False:
            return Response(
                {'detail': 'You cannot remove your own control panel access.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if user.is_superuser and not request.user.is_superuser:
            return Response(
                {'detail': 'Only superusers can modify other superuser accounts.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().partial_update(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def revoke(self, request, pk=None):
        """Remove control panel access without deleting the user account."""
        user = self.get_object()
        if user.id == request.user.id:
            return Response(
                {'detail': 'You cannot remove your own control panel access.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if user.is_superuser and not request.user.is_superuser:
            return Response(
                {'detail': 'Only superusers can revoke superuser access.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        user.is_staff = False
        user.save(update_fields=['is_staff'])
        # Invalidate any active admin tokens for this user.
        Token.objects.filter(user=user).delete()
        return Response({'detail': 'Control panel access revoked.'})


# --- Notification campaigns ---------------------------------------------------

class NotificationCampaignViewSet(viewsets.ModelViewSet):
    """Compose and send notification campaigns from the control panel."""
    serializer_class = NotificationCampaignSerializer
    permission_classes = [IsAdminUser]
    pagination_class = AdminPagination
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        qs = (
            NotificationCampaign.objects.all()
            .select_related('created_by')
            .prefetch_related('recipients')
        )
        search = (self.request.query_params.get('search') or '').strip()
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(body__icontains=search))
        status_param = (self.request.query_params.get('status') or '').strip()
        if status_param:
            qs = qs.filter(status=status_param)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def _guard_editable(self, campaign):
        if campaign.status not in (
            NotificationCampaign.STATUS_DRAFT,
            NotificationCampaign.STATUS_FAILED,
        ):
            return Response(
                {'detail': 'Sent campaigns cannot be modified.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return None

    def partial_update(self, request, *args, **kwargs):
        blocked = self._guard_editable(self.get_object())
        if blocked:
            return blocked
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        blocked = self._guard_editable(self.get_object())
        if blocked:
            return blocked
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['get'])
    def preview(self, request, pk=None):
        """Return the audience size, push reach, and a sample of targeted users."""
        campaign = self.get_object()
        stats = audience_push_stats(campaign)
        return Response(stats)

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        """Deliver the campaign (in-app rows + optional Expo push)."""
        campaign = self.get_object()
        try:
            sent = send_campaign(campaign)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response(
                {'detail': f'Delivery failed: {exc}'},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response(NotificationCampaignSerializer(sent).data)


# --- Analytics --------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAdminUser])
def stats_summary(request):
    now = timezone.now()
    week_ago = now - timedelta(days=7)
    today = now.date()

    signups_by_day = []
    for offset in range(6, -1, -1):
        day = today - timedelta(days=offset)
        count = User.objects.filter(date_joined__date=day).count()
        signups_by_day.append({'date': day.isoformat(), 'count': count})

    economy = UserStats.objects.aggregate(
        total_xp=Sum('xp'),
        total_bot_bucks=Sum('bot_bucks'),
    )

    return Response({
        'users': {
            'total': User.objects.count(),
            'active_last_7_days': UserStats.objects.filter(last_active__gte=week_ago.date()).count(),
            'new_last_7_days': User.objects.filter(date_joined__gte=week_ago).count(),
            'staff': User.objects.filter(is_staff=True).count(),
        },
        'content': {
            'modules': Module.objects.count(),
            'lessons': Lesson.objects.count(),
            'questions': Question.objects.count(),
            'characters': Character.objects.count(),
        },
        'engagement': {
            'lessons_completed': UserProgress.objects.count(),
            'money_chats_passed': MoneyChatSession.objects.filter(passed=True).count(),
            'characters_owned': UserCharacter.objects.count(),
        },
        'economy': {
            'total_xp': economy['total_xp'] or 0,
            'total_bot_bucks': economy['total_bot_bucks'] or 0,
        },
        'signups_by_day': signups_by_day,
    })


# --- AI inspector (read-only) ----------------------------------------------

class TutorConversationViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = TutorConversation.objects.all().select_related('user')
    permission_classes = [IsAdminUser]
    pagination_class = AdminPagination

    def get_queryset(self):
        qs = super().get_queryset()
        search = (self.request.query_params.get('search') or '').strip()
        if search:
            qs = qs.filter(
                Q(user__email__icontains=search) | Q(title__icontains=search)
            )
        return qs

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return TutorConversationDetailSerializer
        return TutorConversationSerializer


class MoneyChatSessionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MoneyChatSession.objects.all().select_related('user', 'module')
    permission_classes = [IsAdminUser]
    pagination_class = AdminPagination

    def get_queryset(self):
        qs = super().get_queryset()
        search = (self.request.query_params.get('search') or '').strip()
        if search:
            qs = qs.filter(
                Q(user__email__icontains=search) | Q(module__title__icontains=search)
            )
        return qs

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return MoneyChatSessionDetailSerializer
        return MoneyChatSessionSerializer


@api_view(['GET'])
@permission_classes([IsAdminUser])
def cache_health(request):
    """Staff-only Redis / cache diagnostics."""
    from django.conf import settings
    from django.core.cache import cache

    from moneybot.cache_utils import CACHE_DEBUG

    backend = settings.CACHES['default']['BACKEND']
    ping_ok = False
    ping_error = None
    try:
        cache.set('_cache_health_ping', 'ok', 10)
        ping_ok = cache.get('_cache_health_ping') == 'ok'
    except Exception as exc:
        ping_error = str(exc)

    return Response({
        'backend': backend,
        'redis_configured': 'redis' in backend.lower(),
        'ping_ok': ping_ok,
        'ping_error': ping_error,
        'cache_debug': CACHE_DEBUG,
    })


# --- Invites ----------------------------------------------------------------

@api_view(['GET', 'PATCH'])
@permission_classes([IsAdminUser])
def invite_config(request):
    from accounts.invites import join_base_url
    from accounts.models import Invite, InviteConfig

    from accounts.models import InviteClaim

    config = InviteConfig.get()
    if request.method == 'PATCH':
        if 'invite_only_enabled' in request.data:
            config.invite_only_enabled = bool(request.data.get('invite_only_enabled'))
        if 'invites_per_user' in request.data:
            try:
                value = int(request.data.get('invites_per_user'))
            except (TypeError, ValueError):
                return Response({'detail': 'invites_per_user must be an integer.'}, status=400)
            if value < 0 or value > 100:
                return Response({'detail': 'invites_per_user must be between 0 and 100.'}, status=400)
            config.invites_per_user = value
        config.save()
        config = InviteConfig.get()

    real_users = User.objects.filter(is_guest=False).count()
    return Response({
        'invite_only_enabled': config.invite_only_enabled,
        'invites_per_user': config.invites_per_user,
        'join_base_url': join_base_url(),
        'stats': {
            'real_users': real_users,
            'invites_total': Invite.objects.count(),
            'invites_used': InviteClaim.objects.count(),
            'invites_available': Invite.objects.filter(
                is_revoked=False, uses_count__lt=F('max_uses'),
            ).count(),
            'seed_available': Invite.objects.filter(
                created_by__isnull=True, is_revoked=False, uses_count__lt=F('max_uses'),
            ).count(),
        },
    })


@api_view(['POST'])
@permission_classes([IsAdminUser])
def invites_bulk_create(request):
    """Generate seed invites (created_by=null) for bootstrapping the first cohort."""
    from accounts.models import Invite

    try:
        count = int(request.data.get('count', 10))
    except (TypeError, ValueError):
        return Response({'detail': 'count must be an integer.'}, status=400)
    if count < 1 or count > 500:
        return Response({'detail': 'count must be between 1 and 500.'}, status=400)

    note = (request.data.get('note') or 'admin seed').strip()[:255]
    created = Invite.create_unique(created_by=None, note=note, count=count)
    return Response({
        'created': len(created),
        'invites': [
            {
                'id': inv.id,
                'code': inv.code,
                'url': inv.join_url,
                'note': inv.note,
                'created_at': inv.created_at.isoformat() if inv.created_at else None,
            }
            for inv in created
        ],
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAdminUser])
def invites_list(request):
    from accounts.models import Invite

    qs = Invite.objects.select_related('created_by', 'used_by').prefetch_related('claims__user')
    status_filter = (request.query_params.get('status') or '').strip().lower()
    if status_filter == 'used':
        qs = qs.filter(uses_count__gt=0)
    elif status_filter == 'available':
        qs = qs.filter(is_revoked=False, uses_count__lt=F('max_uses'))
    elif status_filter == 'revoked':
        qs = qs.filter(is_revoked=True)
    elif status_filter == 'seed':
        qs = qs.filter(created_by__isnull=True)

    search = (request.query_params.get('search') or '').strip()
    if search:
        qs = qs.filter(
            Q(code__icontains=search)
            | Q(note__icontains=search)
            | Q(created_by__email__icontains=search)
            | Q(claims__user__email__icontains=search)
            | Q(created_by__name__icontains=search)
            | Q(claims__user__name__icontains=search)
        ).distinct()

    paginator = AdminPagination()
    page = paginator.paginate_queryset(qs, request)

    def row(inv):
        created_by = None
        if inv.created_by_id:
            created_by = {
                'id': inv.created_by_id,
                'email': inv.created_by.email,
                'name': inv.created_by.name,
            }
        claims = list(inv.claims.all())
        claimed_by = [
            {
                'id': claim.user_id,
                'email': getattr(claim.user, 'email', None),
                'name': getattr(claim.user, 'name', None),
                'joined_at': claim.created_at.isoformat() if claim.created_at else None,
            }
            for claim in claims
        ]
        # Back-compat: expose the most recent redeemer as `used_by`.
        used_by = claimed_by[0] if claimed_by else None
        latest_used_at = claims[0].created_at if claims else inv.used_at
        return {
            'id': inv.id,
            'code': inv.code,
            'url': inv.join_url,
            'status': inv.status,
            'note': inv.note,
            'is_revoked': inv.is_revoked,
            'max_uses': inv.max_uses,
            'uses': inv.uses_count,
            'remaining': inv.remaining,
            'created_by': created_by,
            'used_by': used_by,
            'claimed_by': claimed_by,
            'used_at': latest_used_at.isoformat() if latest_used_at else None,
            'created_at': inv.created_at.isoformat() if inv.created_at else None,
        }

    return paginator.get_paginated_response([row(inv) for inv in page])
