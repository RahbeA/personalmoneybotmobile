from django.db.models import Sum

from courses.models import UserProgress, UserStats
from courses.onboarding import compute_rank
from courses.views import get_or_create_stats
from daily.models import DailyEntry

from .models import GroupChallenge


METRIC_LABELS = {
    GroupChallenge.METRIC_XP: 'XP',
    GroupChallenge.METRIC_LESSONS: 'Lessons',
    GroupChallenge.METRIC_DAILY: 'Daily pts',
    GroupChallenge.METRIC_STREAK: 'Streak days',
}


def display_name(user):
    name = (user.name or '').strip()
    return name if name else user.email.split('@')[0]


def current_metric_value(user, metric):
    """Return the user's current cumulative value for a challenge metric."""
    if metric == GroupChallenge.METRIC_XP:
        return get_or_create_stats(user).xp
    if metric == GroupChallenge.METRIC_LESSONS:
        return UserProgress.objects.filter(user=user).count()
    if metric == GroupChallenge.METRIC_DAILY:
        total = DailyEntry.objects.filter(user=user).aggregate(total=Sum('total_score'))['total']
        return total or 0
    if metric == GroupChallenge.METRIC_STREAK:
        return get_or_create_stats(user).streak_days
    return 0


def uses_baseline(metric):
    return metric != GroupChallenge.METRIC_STREAK


def compute_progress(participant):
    """Return progress dict for a challenge participant."""
    challenge = participant.challenge
    current = current_metric_value(participant.user, challenge.metric)
    if uses_baseline(challenge.metric):
        progress = max(0, current - participant.baseline_value)
    else:
        progress = current
    target = challenge.target
    percent = min(100.0, round((progress / target) * 100, 1)) if target else 0.0
    return {
        'current': current,
        'baseline': participant.baseline_value,
        'progress': progress,
        'target': target,
        'percent': percent,
        'completed': progress >= target,
    }


def serialize_user_brief(user, request=None):
    stats = get_or_create_stats(user)
    equipped = None
    if stats.equipped_character_id:
        from moneyverse.serializers import CharacterSerializer
        equipped = CharacterSerializer(stats.equipped_character, context={'request': request}).data

    return {
        'user_id': user.id,
        'display_name': display_name(user),
        'avatar_url': user.avatar_url or '',
        'rank_tier': compute_rank(stats.onboarding_score, stats.xp),
        'equipped_character': equipped,
    }


def serialize_leaderboard_entry(user, rank, xp, request, is_me=False):
    stats = get_or_create_stats(user)
    equipped = None
    if stats.equipped_character_id:
        from moneyverse.serializers import CharacterSerializer
        equipped = CharacterSerializer(stats.equipped_character, context={'request': request}).data

    return {
        'rank': rank,
        'user_id': user.id,
        'display_name': display_name(user),
        'avatar_url': user.avatar_url or '',
        'xp': xp,
        'streak_days': stats.streak_days,
        'rank_tier': compute_rank(stats.onboarding_score, stats.xp),
        'equipped_character': equipped,
        'is_me': is_me,
    }


def serialize_challenge_entry(participant, rank, request, is_me=False):
    user = participant.user
    stats = get_or_create_stats(user)
    progress = compute_progress(participant)
    equipped = None
    if stats.equipped_character_id:
        from moneyverse.serializers import CharacterSerializer
        equipped = CharacterSerializer(stats.equipped_character, context={'request': request}).data

    return {
        'rank': rank,
        'user_id': user.id,
        'display_name': display_name(user),
        'avatar_url': user.avatar_url or '',
        'rank_tier': compute_rank(stats.onboarding_score, stats.xp),
        'equipped_character': equipped,
        'is_me': is_me,
        **progress,
    }


def are_friends(user_a, user_b):
    from django.db.models import Q

    from .models import Friendship

    if user_a.id == user_b.id:
        return False
    return Friendship.objects.filter(
        Q(requester=user_a, addressee=user_b) | Q(requester=user_b, addressee=user_a),
        status=Friendship.STATUS_ACCEPTED,
    ).exists()


def friend_user_ids(user):
    from django.db.models import Q

    from .models import Friendship

    friendships = Friendship.objects.filter(
        Q(requester=user) | Q(addressee=user),
        status=Friendship.STATUS_ACCEPTED,
    )
    ids = set()
    for f in friendships:
        ids.add(f.addressee_id if f.requester_id == user.id else f.requester_id)
    return ids


def create_notification(recipient, kind, title, body='', actor=None, data=None):
    """Create a notification row + fire a remote push. Best-effort.

    Persists an in-app notification and attempts an Expo push so the recipient
    is notified even when the app is closed. Never raises into the request flow.
    """
    from .models import Notification

    if recipient is None or (actor is not None and actor.id == recipient.id):
        return None
    try:
        notification = Notification.objects.create(
            recipient=recipient,
            actor=actor,
            kind=kind,
            title=title,
            body=body or '',
            data=data or {},
        )
    except Exception:
        return None

    try:
        from .push import push_to_user
        push_to_user(recipient, title, body or '', data={**(data or {}), 'kind': kind})
    except Exception:
        pass

    return notification


def notify_friend_request(actor, recipient, request_id=None):
    from .models import Notification

    name = display_name(actor)
    return create_notification(
        recipient=recipient,
        kind=Notification.TYPE_FRIEND_REQUEST,
        title='New friend request',
        body=f'{name} wants to be your friend.',
        actor=actor,
        data={'user_id': actor.id, 'request_id': request_id},
    )


def notify_friend_accepted(actor, recipient):
    from .models import Notification

    name = display_name(actor)
    return create_notification(
        recipient=recipient,
        kind=Notification.TYPE_FRIEND_ACCEPTED,
        title='Friend request accepted',
        body=f'{name} accepted your friend request. Say hi!',
        actor=actor,
        data={'user_id': actor.id},
    )


def notify_friend_declined(actor, recipient):
    from .models import Notification

    name = display_name(actor)
    return create_notification(
        recipient=recipient,
        kind=Notification.TYPE_FRIEND_DECLINED,
        title='Friend request declined',
        body=f'{name} declined your friend request.',
        actor=actor,
        data={'user_id': actor.id},
    )


def serialize_notification(notification):
    actor_brief = None
    if notification.actor_id:
        actor_brief = serialize_user_brief(notification.actor)
    return {
        'id': notification.id,
        'kind': notification.kind,
        'title': notification.title,
        'body': notification.body,
        'data': notification.data or {},
        'is_read': notification.is_read,
        'created_at': notification.created_at.isoformat(),
        'actor': actor_brief,
    }


def get_group_for_member(group_id, user):
    from .models import Group, GroupMembership

    try:
        group = Group.objects.get(pk=group_id)
    except Group.DoesNotExist:
        return None, None
    membership = GroupMembership.objects.filter(group=group, user=user).first()
    if not membership:
        return None, None
    return group, membership
