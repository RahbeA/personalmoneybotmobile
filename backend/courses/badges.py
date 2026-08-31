"""Evaluate admin-configured badges against user progress."""
from django.db.models import Count

from django.db.models import Q

from moneyverse.models import UserCharacter
from social.models import Friendship

from .models import Badge, Module, UserProgress, UserStats


def _modules_completed_count(user):
    modules = Module.objects.annotate(lesson_count=Count('lessons'))
    completed_ids = set(
        UserProgress.objects.filter(user=user).values_list('lesson_id', flat=True)
    )
    count = 0
    for mod in modules:
        lesson_ids = list(mod.lessons.values_list('id', flat=True))
        if lesson_ids and all(lid in completed_ids for lid in lesson_ids):
            count += 1
    return count


def _module_completed(user, module_id):
    if not module_id:
        return 0
    try:
        mod = Module.objects.get(pk=module_id)
    except Module.DoesNotExist:
        return 0
    lesson_ids = list(mod.lessons.values_list('id', flat=True))
    if not lesson_ids:
        return 0
    done = UserProgress.objects.filter(user=user, lesson_id__in=lesson_ids).count()
    return 1 if done >= len(lesson_ids) else 0


def build_metric_context(user, stats):
    lessons_completed = UserProgress.objects.filter(user=user).count()
    return {
        'stats': stats,
        'lessons_completed': lessons_completed,
        'modules_completed': _modules_completed_count(user),
        'characters_owned': UserCharacter.objects.filter(user=user).count(),
        'friends_count': Friendship.objects.filter(
            Q(requester=user) | Q(addressee=user),
            status=Friendship.STATUS_ACCEPTED,
        ).count(),
    }


def metric_value(badge, ctx):
    stats = ctx['stats']
    metric = badge.metric
    if metric == 'lessons_completed':
        return ctx['lessons_completed']
    if metric == 'modules_completed':
        return ctx['modules_completed']
    if metric == 'module_completed':
        return _module_completed(stats.user, badge.module_id)
    if metric == 'streak_days':
        return stats.streak_days
    if metric == 'daily_claim_streak':
        return stats.daily_claim_streak
    if metric == 'daily_reward_day':
        return stats.daily_reward_day
    if metric == 'bot_bucks':
        return stats.bot_bucks
    if metric == 'xp':
        return stats.xp
    if metric == 'onboarding_score':
        return stats.onboarding_score
    if metric == 'characters_owned':
        return ctx['characters_owned']
    if metric == 'friends_count':
        return ctx['friends_count']
    if metric == 'questions_correct':
        return stats.questions_correct
    if metric == 'perfect_lessons':
        return stats.perfect_lessons
    return 0


def evaluate_and_award(user, stats=None):
    """Return list of newly earned badge keys; mutates stats.badges in place."""
    stats = stats or UserStats.objects.get(user=user)
    ctx = build_metric_context(user, stats)
    earned = set(stats.badges or [])
    newly = []

    for badge in Badge.objects.filter(is_active=True).order_by('order', 'id'):
        if badge.key in earned:
            continue
        if metric_value(badge, ctx) >= badge.threshold:
            earned.add(badge.key)
            newly.append(badge.key)

    if newly:
        stats.badges = list(earned)
    return newly


def badge_catalog_for_request(request):
    """All active badges with icon URLs for clients."""
    from django.core.cache import cache
    from .serializers import BadgeCatalogSerializer

    cached = cache.get('course:badge_catalog:v1')
    if cached is not None:
        return cached

    badges = Badge.objects.filter(is_active=True).order_by('order', 'id')
    data = BadgeCatalogSerializer(badges, many=True, context={'request': request}).data
    cache.set('course:badge_catalog:v1', data, 3600)
    return data
