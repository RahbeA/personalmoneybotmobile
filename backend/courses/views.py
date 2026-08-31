from datetime import date, timedelta
import copy

from django.db import transaction
from django.db.models import F, Prefetch, Window
from django.utils.dateparse import parse_date
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
    user_modules_cache_key,
    user_stats_cache_key,
)
from .models import Module, Lesson, Question, UserProgress, UserStats
from .serializers import (
    ModuleSerializer, LessonSerializer, QuestionSerializer,
    UserStatsSerializer, LessonCompleteSerializer,
)
from . import onboarding
from .onboarding import compute_rank, literacy_points

LEADERBOARD_TOP_N = 10
LEADERBOARD_SEARCH_LIMIT = 25
LEADERBOARD_MAX_PAGE_SIZE = 50

XP_PER_LESSON = 50
XP_BONUS_PERFECT = 10  # bonus for 0 mistakes
BOT_BUCKS_PER_LESSON = 10
BOT_BUCKS_PERFECT_BONUS = 5  # bonus Bot Bucks for 0 mistakes

# One-time welcome grant for finishing the onboarding assessment.
ONBOARDING_XP_BONUS = 10
ONBOARDING_BOT_BUCKS_BONUS = 25


def get_or_create_stats(user):
    stats, created = UserStats.objects.get_or_create(user=user)
    if created or stats.equipped_character_id:
        return UserStats.objects.select_related('equipped_character').get(pk=stats.pk)
    return stats


def resolve_client_today(raw):
    """Resolve the device-local calendar date used for daily-streak boundaries.

    Daily streaks reset at the user's local midnight, so the mobile app sends
    its local date (YYYY-MM-DD). Fall back to the server date (UTC) when it is
    missing or unparseable, preserving the previous behaviour.
    """
    if raw:
        parsed = raw if isinstance(raw, date) else parse_date(raw)
        if parsed:
            return parsed
    return date.today()


def client_today_from_request(request):
    raw = request.query_params.get('client_date') or request.data.get('client_date')
    return resolve_client_today(raw)


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
    key = user_modules_cache_key(request.user.id)
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
    today = resolve_client_today(serializer.validated_data.get('client_date'))

    # Reward candidates applied only if this POST is the FIRST completion.
    if mistakes == 0:
        candidate_xp = XP_PER_LESSON + XP_BONUS_PERFECT
        candidate_stars = 3
    elif mistakes == 1:
        candidate_xp = XP_PER_LESSON
        candidate_stars = 2
    else:
        candidate_xp = max(XP_PER_LESSON - (mistakes * 5), 10)
        candidate_stars = 1
    candidate_bot_bucks = BOT_BUCKS_PER_LESSON + (BOT_BUCKS_PERFECT_BONUS if mistakes == 0 else 0)

    xp_earned = 0
    stars = candidate_stars
    new_badge = None
    bot_bucks_earned = 0

    # get_or_create inside a transaction: the unique_together (user, lesson)
    # constraint makes a duplicate/concurrent double-tap collapse into a single
    # row instead of racing two exists()+create() calls into an IntegrityError.
    with transaction.atomic():
        progress, created = UserProgress.objects.get_or_create(
            user=request.user,
            lesson=lesson,
            defaults={'xp_earned': candidate_xp, 'stars': candidate_stars},
        )
        already_completed = not created

        if created:
            xp_earned = candidate_xp
            bot_bucks_earned = candidate_bot_bucks

            stats = get_or_create_stats(request.user)
            stats.xp += xp_earned
            stats.bot_bucks += bot_bucks_earned

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
        else:
            stars = progress.stars

    # Always bump the per-user cache version so the next modules/stats fetch is
    # rebuilt fresh. This runs on the already_completed path too: a client only
    # replays a finished lesson when its cached roadmap drifted stale, so busting
    # here stops the "loops on the same lesson" symptom.
    invalidate_user_cache(request.user.id)
    if created:
        invalidate_leaderboard_snapshots()

    updated_stats = get_or_create_stats(request.user)

    module = lesson.module
    module_lessons_total = module.lessons.count()
    completed_lesson_ids = list(
        UserProgress.objects.filter(user=request.user).values_list('lesson_id', flat=True)
    )
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
        # Authoritative completion set so the client reconciles from THIS response
        # instead of a follow-up GET that may still be serving a stale snapshot.
        'completed_lesson_ids': completed_lesson_ids,
        'lessons_completed': len(completed_lesson_ids),
        'stats': UserStatsSerializer(updated_stats, context={'request': request}).data,
    })


def _leaderboard_stats_qs():
    # Guests have no durable identity (and no email), so they never rank.
    return UserStats.objects.select_related('user', 'equipped_character').filter(
        user__is_guest=False,
    ).annotate(
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
    from .daily_rewards import effective_streak

    user = stats.user
    name = (user.name or '').strip()
    display_name = name or (user.email or '').split('@')[0] or 'Learner'
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
        'streak_days': effective_streak(stats),
        'literacy_points': literacy_points(stats.onboarding_score, stats.xp),
        'rank_tier': compute_rank(stats.onboarding_score, stats.xp),
        'equipped_character': equipped,
        'is_me': request.user.id == user.id,
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def leaderboard(request):
    """Top-N board + caller rank, or name/email search with global ranks."""
    # Ranking is account-based (Apple 5.1.1(v)); guests browse lessons instead.
    if getattr(request.user, 'is_guest', False):
        return Response(
            {
                'error': 'Create a free account to see the leaderboard and compete with friends.',
                'code': 'account_required',
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    search = (request.query_params.get('search') or '').strip()
    if search:
        data = _build_leaderboard_search_payload(request, search)
        return Response(data)

    # Shared snapshot is just the top board; each caller's "me" is applied after cache.
    cache_key = leaderboard_cache_key(1, LEADERBOARD_TOP_N, '')

    def factory():
        return strip_leaderboard_user_flags(
            _build_leaderboard_payload(request),
        )

    cached, hit = cache_get_or_set(cache_key, factory, TTL_LEADERBOARD)

    my_id = request.user.id
    me_in_top = next(
        (e for e in cached.get('top') or [] if e.get('user_id') == my_id),
        None,
    )
    if me_in_top:
        # Same rank as the visible top list (avoids stale-cache vs fresh-me mismatch).
        me_entry = copy.deepcopy(me_in_top)
        me_entry['is_me'] = True
    else:
        my_stats = get_or_create_stats(request.user)
        rank = _compute_user_rank(request.user, my_stats)
        me_entry = _serialize_leaderboard_entry(my_stats, rank, request)

    data = apply_leaderboard_user_flags(cached, request, me_entry)
    return attach_cache_header(Response(data), hit)


def _compute_user_rank(user, stats):
    """Global 1-based rank for a single user.

    NOTE: We deliberately avoid ``ranked_qs.get(pk=...)`` here. Filtering a
    queryset that carries a ``RowNumber()`` window by a non-window column (pk)
    pushes the filter into WHERE, which runs *before* the window is evaluated —
    so ``RowNumber()`` sees a single row and always returns 1. Instead we count
    how many learners outrank this user, matching the queryset ordering
    (lp desc, then earlier date_joined wins ties).
    """
    base = _leaderboard_stats_qs()
    my_lp = (stats.onboarding_score or 0) * 100 + (stats.xp or 0)
    higher = base.filter(lp__gt=my_lp).count()
    ties_ahead = base.filter(
        lp=my_lp,
        user__date_joined__lt=user.date_joined,
    ).exclude(pk=stats.pk).count()
    return higher + ties_ahead + 1


def _build_leaderboard_payload(request):
    """Top N entries + total learner count. Caller-specific `me` is layered on after cache."""
    ranked = _leaderboard_ranked_qs(_leaderboard_stats_qs())
    total_count = ranked.count()

    top_stats = list(ranked.filter(rank__lte=LEADERBOARD_TOP_N).order_by('rank'))
    top = [
        _serialize_leaderboard_entry(stats, stats.rank, request)
        for stats in top_stats
    ]

    return {
        'top': top,
        'me': None,
        'entries': [],
        'total_count': total_count,
        'pagination': {
            'page': 1,
            'page_size': LEADERBOARD_TOP_N,
            'total_count': total_count,
            'has_next': False,
        },
        'search': '',
    }


def _build_leaderboard_search_payload(request, search):
    """Match learners by name/email and return their global ranks (not search-local ranks)."""
    # Rank everyone first, then filter — filtering before Window() recomputes ranks
    # within the match set (e.g. friend at global #47 would wrongly show as #1).
    ordered = list(
        _leaderboard_stats_qs().order_by(F('lp').desc(), F('user__date_joined').asc())
    )
    total_count = len(ordered)
    needle = search.lower()
    entries = []
    for index, stats in enumerate(ordered, start=1):
        user = stats.user
        name = (user.name or '').lower()
        email = (user.email or '').lower()
        if needle not in name and needle not in email:
            continue
        entry = _serialize_leaderboard_entry(stats, index, request)
        entries.append(entry)
        if len(entries) >= LEADERBOARD_SEARCH_LIMIT:
            break

    my_id = request.user.id
    for entry in entries:
        entry['is_me'] = entry.get('user_id') == my_id

    me_entry = next((e for e in entries if e.get('is_me')), None)
    if me_entry is None:
        my_stats = get_or_create_stats(request.user)
        me_rank = next(
            (i for i, s in enumerate(ordered, start=1) if s.pk == my_stats.pk),
            total_count + 1,
        )
        # Prefer already-loaded row when present so we don't re-fetch.
        mine = next((s for s in ordered if s.pk == my_stats.pk), my_stats)
        me_entry = _serialize_leaderboard_entry(mine, me_rank, request)
        me_entry['is_me'] = True

    return {
        'top': [],
        'me': me_entry,
        'entries': entries,
        'total_count': total_count,
        'pagination': {
            'page': 1,
            'page_size': LEADERBOARD_SEARCH_LIMIT,
            'total_count': len(entries),
            'has_next': False,
        },
        'search': search,
    }


def _build_user_stats(request, today=None):
    stats = get_or_create_stats(request.user)
    completed_lesson_ids = list(
        UserProgress.objects.filter(user=request.user).values_list('lesson_id', flat=True)
    )
    from .badges import badge_catalog_for_request
    from .daily_rewards import daily_reward_status
    from .tips import pick_money_tip, serialize_tip

    return {
        **UserStatsSerializer(stats, context={'request': request, 'client_today': today}).data,
        'completed_lesson_ids': completed_lesson_ids,
        'lessons_completed': len(completed_lesson_ids),
        'badge_catalog': badge_catalog_for_request(request),
        'daily_reward': daily_reward_status(stats, today),
        'money_tip': serialize_tip(pick_money_tip(stats)),
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_stats(request):
    today = client_today_from_request(request)
    key = user_stats_cache_key(request.user.id)
    data, hit = cache_get_or_set(key, lambda: _build_user_stats(request, today), TTL_USER_STATS)
    # daily_reward is date-sensitive (can_claim / claimed_today / current_day are
    # relative to the client's local "today"). The cache key has no date, so a
    # blob cached just before local midnight would otherwise serve a stale reward
    # for up to the TTL. Recompute it every request so the card reflects the
    # correct claimable state (DEV-459).
    from .daily_rewards import daily_reward_status
    from .tips import pick_money_tip, serialize_tip

    stats = get_or_create_stats(request.user)
    tip = pick_money_tip(stats)
    if tip and stats.last_money_tip_id != tip.id:
        stats.last_money_tip = tip
        stats.save(update_fields=['last_money_tip'])
    data = {
        **data,
        'daily_reward': daily_reward_status(stats, today),
        'money_tip': serialize_tip(tip),
    }
    return attach_cache_header(Response(data), hit)


ALLOWED_STREAK_GOALS = {7, 14, 30, 60}


def _parse_streak_goal(raw):
    try:
        goal = int(raw)
    except (TypeError, ValueError):
        return None
    if goal not in ALLOWED_STREAK_GOALS:
        return None
    return goal


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def claim_daily_reward(request):
    """Claim today's daily login Bot Bucks reward."""
    from .daily_rewards import claim_daily_reward as do_claim

    today = client_today_from_request(request)
    stats = get_or_create_stats(request.user)

    # Optional: set streak commitment in the same request (onboarding).
    streak_goal = _parse_streak_goal(request.data.get('streak_goal'))
    if streak_goal is not None and stats.streak_goal != streak_goal:
        stats.streak_goal = streak_goal
        stats.save(update_fields=['streak_goal'])

    try:
        amount, reward_status = do_claim(request.user, stats, today)
    except ValueError as exc:
        return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    invalidate_user_cache(request.user.id)

    stats = get_or_create_stats(request.user)
    return Response({
        'bot_bucks_earned': amount,
        'bot_bucks': stats.bot_bucks,
        'daily_reward': reward_status,
        'badges': stats.badges,
        'streak_goal': stats.streak_goal,
        'stats': UserStatsSerializer(
            stats, context={'request': request, 'client_today': today},
        ).data,
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

    data, hit = cache_get_or_set('course:onboarding:questions:v2', factory, TTL_ONBOARDING)
    return attach_cache_header(Response(data), hit)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_goals(request):
    """Update just the user's selected goals (editable from Settings)."""
    goals = request.data.get('goals')
    if not isinstance(goals, list):
        return Response(
            {'detail': 'goals must be a list of goal keys.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    goals = [str(g)[:50] for g in goals][:12]

    stats = get_or_create_stats(request.user)
    stats.onboarding_goals = goals
    stats.save(update_fields=['onboarding_goals'])
    invalidate_user_cache(request.user.id)

    return Response({
        'onboarding_goals': goals,
        'stats': UserStatsSerializer(stats, context={'request': request}).data,
    })


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_streak_goal(request):
    """Set the user's personal streak commitment (7 / 14 / 30 / 60 days)."""
    streak_goal = _parse_streak_goal(request.data.get('streak_goal'))
    if streak_goal is None:
        return Response(
            {'detail': f'streak_goal must be one of {sorted(ALLOWED_STREAK_GOALS)}.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    stats = get_or_create_stats(request.user)
    stats.streak_goal = streak_goal
    stats.save(update_fields=['streak_goal'])
    invalidate_user_cache(request.user.id)

    return Response({
        'streak_goal': streak_goal,
        'stats': UserStatsSerializer(stats, context={'request': request}).data,
    })


CHAT_PERSONALITIES = {choice[0] for choice in UserStats.CHAT_PERSONALITY_CHOICES}


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_personality(request):
    """Set Tutor / Money Chat voice (DEV-656)."""
    personality = (request.data.get('chat_personality') or '').strip()
    if personality not in CHAT_PERSONALITIES:
        return Response(
            {
                'detail': f'chat_personality must be one of {sorted(CHAT_PERSONALITIES)}.',
            },
            status=status.HTTP_400_BAD_REQUEST,
        )
    stats = get_or_create_stats(request.user)
    stats.chat_personality = personality
    stats.save(update_fields=['chat_personality'])
    invalidate_user_cache(request.user.id)
    return Response({
        'chat_personality': personality,
        'stats': UserStatsSerializer(stats, context={'request': request}).data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def todays_money_tip(request):
    """Today's Home money tip, rotated so it does not immediately repeat (DEV-660/661)."""
    from .tips import pick_money_tip, serialize_tip

    stats = get_or_create_stats(request.user)
    tip = pick_money_tip(stats)
    if tip and stats.last_money_tip_id != tip.id:
        stats.last_money_tip = tip
        stats.save(update_fields=['last_money_tip'])
    return Response({'tip': serialize_tip(tip)})


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

    goals = request.data.get('goals') or []
    if not isinstance(goals, list):
        goals = []
    # Keep only simple string keys, capped, to avoid storing arbitrary payloads.
    goals = [str(g)[:50] for g in goals][:12]

    stats = get_or_create_stats(request.user)
    # Only grant the welcome bonus the first time onboarding is completed so
    # re-submitting the assessment can't farm Bot Bucks/XP.
    first_completion = not stats.onboarding_completed
    stats.onboarding_completed = True
    stats.onboarding_score = num_correct
    stats.onboarding_answers = answers
    stats.onboarding_goals = goals
    update_fields = [
        'onboarding_completed', 'onboarding_score', 'onboarding_answers', 'onboarding_goals',
    ]

    bonus_xp = 0
    bonus_bot_bucks = 0
    if first_completion:
        bonus_xp = ONBOARDING_XP_BONUS
        bonus_bot_bucks = ONBOARDING_BOT_BUCKS_BONUS
        stats.xp += bonus_xp
        stats.bot_bucks += bonus_bot_bucks
        update_fields += ['xp', 'bot_bucks']

    stats.save(update_fields=update_fields)

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
        'onboarding_bonus': {'xp': bonus_xp, 'bot_bucks': bonus_bot_bucks},
        'stats': UserStatsSerializer(stats, context={'request': request}).data,
    })
