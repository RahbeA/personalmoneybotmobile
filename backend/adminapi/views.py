from datetime import timedelta

from django.contrib.auth import authenticate, get_user_model
from django.db.models import Count, Sum, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response

from courses.models import (
    Module, Lesson, Question, Answer, UserProgress, UserStats, OnboardingQuestion,
)
from moneyverse.models import Character, UserCharacter
from ai.models import TutorConversation, MoneyChatSession
from .pagination import AdminPagination
from .permissions import IsAdminUserOrReadOnly
from .serializers import (
    ModuleSerializer,
    LessonSerializer,
    QuestionSerializer,
    AnswerSerializer,
    CharacterSerializer,
    OnboardingQuestionSerializer,
    AdminUserSerializer,
    AdminStaffSerializer,
    StaffCreateSerializer,
    TutorConversationSerializer,
    TutorConversationDetailSerializer,
    MoneyChatSessionSerializer,
    MoneyChatSessionDetailSerializer,
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
        'user': {
            'id': user.id,
            'email': user.email,
            'name': user.name,
            'is_superuser': user.is_superuser,
        },
    })


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_me(request):
    user = request.user
    return Response({
        'id': user.id,
        'email': user.email,
        'name': user.name,
        'is_superuser': user.is_superuser,
    })


@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_logout(request):
    try:
        request.user.auth_token.delete()
    except Exception:
        pass
    return Response({'detail': 'Logged out.'})


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


class CharacterViewSet(viewsets.ModelViewSet):
    queryset = Character.objects.all()
    serializer_class = CharacterSerializer
    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]


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
                user.set_password(password)
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
