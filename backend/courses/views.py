from datetime import date, timedelta
import copy

from django.db.models import F, Prefetch, Q, Window
from django.db.models.functions import RowNumber
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from moneybot.cache_utils import (
    TTL_LEADERBOARD,
    TTL_LESSON_QUESTIONS,
    TTL_ONBOARDING,
    TTL_USER_MODULES,
    TTL_USER_STATS,
    apply_leaderboard_user_flags,
    attach_cache_header,
    cache_get_or_set,
    invalidate_leaderboard_snapshots,
    invalidate_user_cache,
    leaderboard_cache_key,
    strip_leaderboard_user_flags,
)
from .models import Module, Lesson, Question, UserProgress, UserStats
from .serializers import (
    ModuleSerializer, LessonSerializer, QuestionSerializer,
    UserStatsSerializer, LessonCompleteSerializer,
)
from . import onboarding
from .onboarding import compute_rank, literacy_points

LEADERBOARD_TOP_N = 10
LEADERBOARD_DEFAULT_PAGE_SIZE = 20
LEADERBOARD_MAX_PAGE_SIZE = 50

XP_PER_LESSON = 50
XP_BONUS_PERFECT = 10  # bonus for 0 mistakes
BOT_BUCKS_PER_LESSON = 10
BOT_BUCKS_PERFECT_BONUS = 5  # bonus Bot Bucks for 0 mistakes


def get_or_create_stats(user):
    stats, created = UserStats.objects.get_or_create(user=user)
    if created or stats.equipped_character_id:
        return UserStats.objects.select_related('equipped_character').get(pk=stats.pk)
    return stats


def _module_list_context(request):
    completed_lesson_ids = set(
        UserProgress.objects.filter(user=request.user).values_list('lesson_id', flat=True)
    )
    lesson_qs = Lesson.objects.prefetch_related('questions').order_by('order')
    modules = Module.objects.prefetch_related(
        Prefetch('lessons', queryset=lesson_qs),
    ).order_by('order')
    return modules, {
        'request': request,
        'completed_lesson_ids': completed_lesson_ids,
    }


def _serialize_modules(request):
    modules, ctx = _module_list_context(request)
    serializer = ModuleSerializer(modules, many=True, context=ctx)
    return serializer.data


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def module_list(request):
    key = f'user:{request.user.id}:modules:v1'
    data, hit = cache_get_or_set(key, lambda: _serialize_modules(request), TTL_USER_MODULES)
    return attach_cache_header(Response(data), hit)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def module_lessons(request, module_id):
    try:
        module = Module.objects.get(id=module_id)
    except Module.DoesNotExist:
        return Response({'detail': 'Module not found.'}, status=status.HTTP_404_NOT_FOUND)
    completed_lesson_ids = set(
        UserProgress.objects.filter(user=request.user).values_list('lesson_id', flat=True)
    )
    lessons = module.lessons.prefetch_related('questions').order_by('order')
    serializer = LessonSerializer(
        lessons, many=True,
        context={'request': request, 'completed_lesson_ids': completed_lesson_ids},
    )
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def lesson_questions(request, lesson_id):
    try:
        Lesson.objects.get(id=lesson_id)
    except Lesson.DoesNotExist:
        return Response({'detail': 'Lesson not found.'}, status=status.HTTP_404_NOT_FOUND)

    key = f'course:lesson:{lesson_id}:questions:v1'

    def factory():
        lesson = Lesson.objects.get(id=lesson_id)
        serializer = QuestionSerializer(lesson.questions.prefetch_related('answers').all(), many=True)
        return serializer.data

    data, hit = cache_get_or_set(key, factory, TTL_LESSON_QUESTIONS)
    return attach_cache_header(Response(data), hit)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def complete_lesson(request, lesson_id):
    try:
        lesson = Lesson.objects.get(id=lesson_id)
    except Lesson.DoesNotExist:
        return Response({'detail': 'Lesson not found.'}, status=status.HTTP_404_NOT_FOUND)

    serializer = LessonCompleteSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    mistakes = serializer.validated_data['mistakes']

    already_completed = UserProgress.objects.filter(user=request.user, lesson=lesson).exists()

    xp_earned = 0
    stars = 3
    new_badge = None
    bot_bucks_earned = 0

    if not already_completed:
        if mistakes == 0:
            xp_earned = XP_PER_LESSON + XP_BONUS_PERFECT
        elif mistakes == 1:
            stars = 2
            xp_earned = XP_PER_LESSON
        else:
            stars = 1
            xp_earned = max(XP_PER_LESSON - (mistakes * 5), 10)

        bot_bucks_earned = BOT_BUCKS_PER_LESSON + (BOT_BUCKS_PERFECT_BONUS if mistakes == 0 else 0)

        UserProgress.objects.create(
            user=request.user,
            lesson=lesson,
            xp_earned=xp_earned,
            stars=stars,
        )

        stats = get_or_create_stats(request.user)
        stats.xp += xp_earned
        stats.bot_bucks += bot_bucks_earned

        today = date.today()
        if stats.last_active == today - timedelta(days=1):
            stats.streak_days += 1
        elif stats.last_active != today:
            stats.streak_days = 1
        stats.last_active = today

        question_count = lesson.questions.count()
        stats.questions_answered += question_count
        stats.questions_correct += max(0, question_count - mistakes)
        if mistakes == 0:
            stats.perfect_lessons += 1

        from .badges import evaluate_and_award
        new_badges = evaluate_and_award(request.user, stats)
        new_badge = new_badges[0] if new_badges else None

        stats.save()

        invalidate_user_cache(request.user.id)
        invalidate_leaderboard_snapshots()

    updated_stats = get_or_create_stats(request.user)
    module_complete = False
    if not already_completed:
        module = lesson.module
        module_lessons_total = module.lessons.count()
        module_lessons_done = UserProgress.objects.filter(
            user=request.user, lesson__module=module
        ).count()
        module_complete = module_lessons_done >= module_lessons_total

    return Response({
        'already_completed': already_completed,
        'xp_earned': xp_earned,
        'bot_bucks_earned': bot_bucks_earned,
        'stars': stars,
        'new_badge': new_badge,
        'module_complete': module_complete,
        'module_title': lesson.module.title,
        'module_icon': lesson.module.icon,
        'stats': UserStatsSerializer(updated_stats, context={'request': request}).data,
    })


def _leaderboard_stats_qs():
    return UserStats.objects.select_related('user', 'equipped_character').annotate(
        lp=F('onboarding_score') * 100 + F('xp'),
    )


def _leaderboard_ranked_qs(qs):
    return qs.annotate(
        rank=Window(
            expression=RowNumber(),
            order_by=[F('lp').desc(), F('user__date_joined').asc()],
        ),
    )


def _serialize_leaderboard_entry(stats, rank, request):
    user = stats.user
    name = (user.name or '').strip()
    display_name = name if name else user.email.split('@')[0]
    equipped = None
    if stats.equipped_character_id:
        from moneyverse.serializers import CharacterSerializer
        equipped = CharacterSerializer(stats.equipped_character, context={'request': request}).data

    return {
        'rank': rank,
        'user_id': user.id,
        'display_name': display_name,
        'avatar_url': user.avatar_url or '',
        'xp': stats.xp,
        'streak_days': stats.streak_days,
        'literacy_points': literacy_points(stats.onboarding_score, stats.xp),
        'rank_tier': compute_rank(stats.onboarding_score, stats.xp),
        'equipped_character': equipped,
        'is_me': request.user.id == user.id,
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def leaderboard(request):
    """Global user leaderboard ordered by literacy points (onboarding + XP)."""
    search = (request.query_params.get('search') or '').strip()
    try:
        page = max(int(request.query_params.get('page', 1)), 1)
    except (TypeError, ValueError):
        page = 1
    try:
        page_size = int(request.query_params.get('page_size', LEADERBOARD_DEFAULT_PAGE_SIZE))
    except (TypeError, ValueError):
        page_size = LEADERBOARD_DEFAULT_PAGE_SIZE
    page_size = min(max(page_size, 1), LEADERBOARD_MAX_PAGE_SIZE)

    cache_key = leaderboard_cache_key(page, page_size, search)

    def factory():
        return strip_leaderboard_user_flags(
            _build_leaderboard_payload(request, search, page, page_size),
        )

    cached, hit = cache_get_or_set(cache_key, factory, TTL_LEADERBOARD)

    me_entry = None
    if not search:
        my_id = request.user.id
        me_in_top = next(
            (e for e in cached.get('top') or [] if e.get('user_id') == my_id),
            None,
        )
        if me_in_top:
            # Use the same rank as the visible top list (avoids stale-cache vs fresh-me mismatch).
            me_entry = copy.deepcopy(me_in_top)
            me_entry['is_me'] = True
        else:
            my_stats = get_or_create_stats(request.user)
            ranked = _leaderboard_ranked_qs(_leaderboard_stats_qs())
            try:
                my_stats = ranked.get(pk=my_stats.pk)
                me_entry = _serialize_leaderboard_entry(my_stats, my_stats.rank, request)
            except UserStats.DoesNotExist:
                me_entry = None

    data = apply_leaderboard_user_flags(cached, request, me_entry)
    return attach_cache_header(Response(data), hit)


def _build_leaderboard_payload(request, search, page, page_size):
    base_qs = _leaderboard_stats_qs()

    if search:
        filtered = base_qs.filter(
            Q(user__name__icontains=search) | Q(user__email__icontains=search),
        )
        ranked = _leaderboard_ranked_qs(filtered)
        total_count = ranked.count()
        offset = (page - 1) * page_size
        page_stats = list(ranked.order_by('rank')[offset:offset + page_size])
        entries = [
            _serialize_leaderboard_entry(stats, stats.rank, request)
            for stats in page_stats
        ]
        return {
            'top': [],
            'me': None,
            'entries': entries,
            'pagination': {
                'page': page,
                'page_size': page_size,
                'total_count': total_count,
                'has_next': offset + page_size < total_count,
            },
            'search': search,
        }

    ranked = _leaderboard_ranked_qs(base_qs)
    total_count = ranked.count()

    top_stats = list(ranked.filter(rank__lte=LEADERBOARD_TOP_N).order_by('rank'))
    top = [
        _serialize_leaderboard_entry(stats, stats.rank, request)
        for stats in top_stats
    ]

    my_stats = get_or_create_stats(request.user)
    try:
        my_stats = ranked.get(pk=my_stats.pk)
    except UserStats.DoesNotExist:
        my_stats = _leaderboard_stats_qs().get(pk=my_stats.pk)
        my_stats.rank = total_count + 1
    me = _serialize_leaderboard_entry(my_stats, my_stats.rank, request)

    offset = LEADERBOARD_TOP_N + (page - 1) * page_size
    page_stats = list(
        ranked.filter(rank__gt=LEADERBOARD_TOP_N).order_by('rank')[offset:offset + page_size]
    )
    entries = [
        _serialize_leaderboard_entry(stats, stats.rank, request)
        for stats in page_stats
    ]

    remaining = max(total_count - LEADERBOARD_TOP_N, 0)
    has_next = page * page_size < remaining

    return {
        'top': top,
        'me': me,
        'entries': entries,
        'pagination': {
            'page': page,
            'page_size': page_size,
            'total_count': total_count,
            'has_next': has_next,
        },
        'search': '',
    }


def _build_user_stats(request):
    stats = get_or_create_stats(request.user)
    completed_lesson_ids = list(
        UserProgress.objects.filter(user=request.user).values_list('lesson_id', flat=True)
    )
    from .badges import badge_catalog_for_request
    from .daily_rewards import daily_reward_status

    return {
        **UserStatsSerializer(stats, context={'request': request}).data,
        'completed_lesson_ids': completed_lesson_ids,
        'lessons_completed': len(completed_lesson_ids),
        'badge_catalog': badge_catalog_for_request(request),
        'daily_reward': daily_reward_status(stats),
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_stats(request):
    key = f'user:{request.user.id}:stats:v1'
    data, hit = cache_get_or_set(key, lambda: _build_user_stats(request), TTL_USER_STATS)
    return attach_cache_header(Response(data), hit)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def claim_daily_reward(request):
    """Claim today's daily login Bot Bucks reward."""
    from .daily_rewards import claim_daily_reward as do_claim

    stats = get_or_create_stats(request.user)
    try:
        amount, reward_status = do_claim(request.user, stats)
    except ValueError as exc:
        return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    invalidate_user_cache(request.user.id)

    stats = get_or_create_stats(request.user)
    return Response({
        'bot_bucks_earned': amount,
        'bot_bucks': stats.bot_bucks,
        'daily_reward': reward_status,
        'badges': stats.badges,
        'stats': UserStatsSerializer(stats, context={'request': request}).data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def onboarding_questions(request):
    """Return the financial-literacy onboarding questions (no answer keys)."""

    def factory():
        return {
            'questions': onboarding.public_questions(),
            'total': onboarding.total_questions(),
        }

    data, hit = cache_get_or_set('course:onboarding:questions:v1', factory, TTL_ONBOARDING)
    return attach_cache_header(Response(data), hit)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def onboarding_submit(request):
    """Score the onboarding assessment, persist the baseline, and return rank."""
    answers = request.data.get('answers') or {}
    if not isinstance(answers, dict):
        return Response(
            {'detail': 'answers must be an object of {question_id: option_id}.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    num_correct, results = onboarding.score_answers(answers)

    stats = get_or_create_stats(request.user)
    stats.onboarding_completed = True
    stats.onboarding_score = num_correct
    stats.onboarding_answers = answers
    stats.save(update_fields=['onboarding_completed', 'onboarding_score', 'onboarding_answers'])

    from .badges import evaluate_and_award
    evaluate_and_award(request.user, stats)

    invalidate_user_cache(request.user.id)
    invalidate_leaderboard_snapshots()

    rank = onboarding.compute_rank(num_correct, stats.xp)

    return Response({
        'score': num_correct,
        'total': onboarding.total_questions(),
        'results': results,
        'rank': rank,
        'stats': UserStatsSerializer(stats, context={'request': request}).data,
    })
