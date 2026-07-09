from datetime import datetime

from django.contrib import admin
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import User

from . import service
from .models import (
    ChallengeParticipant,
    Friendship,
    Group,
    GroupChallenge,
    GroupInvite,
    GroupMembership,
    Notification,
    DeviceToken,
)

NOTIFICATIONS_PAGE_SIZE = 50


def _enroll_in_active_challenges(group, user):
    """Add a newly joined member to every ongoing challenge in the group."""
    for challenge in group.challenges.filter(ends_at__gte=timezone.now()):
        baseline = (
            service.current_metric_value(user, challenge.metric)
            if service.uses_baseline(challenge.metric) else 0
        )
        ChallengeParticipant.objects.get_or_create(
            challenge=challenge,
            user=user,
            defaults={'baseline_value': baseline},
        )


def _parse_datetime(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value if timezone.is_aware(value) else timezone.make_aware(value)
    try:
        dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
        return dt if timezone.is_aware(dt) else timezone.make_aware(dt)
    except (TypeError, ValueError):
        return None


def _friendship_status(user, other_id):
    """Return friendship row between user and other if any."""
    return Friendship.objects.filter(
        Q(requester=user, addressee_id=other_id) | Q(requester_id=other_id, addressee=user),
    ).first()


def _serialize_friendship_request(friendship, perspective_user):
    if friendship.requester_id == perspective_user.id:
        other = friendship.addressee
        direction = 'outgoing'
    else:
        other = friendship.requester
        direction = 'incoming'
    return {
        'id': friendship.id,
        'direction': direction,
        'status': friendship.status,
        'created_at': friendship.created_at.isoformat(),
        'user': service.serialize_user_brief(other),
    }


def _serialize_group_summary(group, request):
    member_count = group.memberships.count()
    active = group.challenges.filter(
        starts_at__lte=timezone.now(),
        ends_at__gte=timezone.now(),
    ).first()
    active_challenge = None
    if active:
        active_challenge = {
            'id': active.id,
            'title': active.title,
            'metric': active.metric,
            'metric_label': service.METRIC_LABELS.get(active.metric, active.metric),
            'target': active.target,
            'ends_at': active.ends_at.isoformat(),
        }
    return {
        'id': group.id,
        'name': group.name,
        'emoji': group.emoji,
        'owner_id': group.owner_id,
        'member_count': member_count,
        'created_at': group.created_at.isoformat(),
        'active_challenge': active_challenge,
    }


def _serialize_group_detail(group, request):
    members = [
        {
            **service.serialize_user_brief(m.user, request),
            'role': m.role,
            'joined_at': m.joined_at.isoformat(),
        }
        for m in group.memberships.select_related('user').order_by('joined_at')
    ]
    pending_invites = [
        {
            **service.serialize_user_brief(inv.invited_user, request),
            'invite_id': inv.id,
            'invited_at': inv.created_at.isoformat(),
        }
        for inv in group.invites.filter(status=GroupInvite.STATUS_PENDING)
        .select_related('invited_user').order_by('-created_at')
    ]
    return {
        **_serialize_group_summary(group, request),
        'members': members,
        'pending_invites': pending_invites,
    }


def _serialize_group_invite(invite, request):
    return {
        'invite_id': invite.id,
        'created_at': invite.created_at.isoformat(),
        'invited_by': service.display_name(invite.invited_by),
        'group': {
            'id': invite.group_id,
            'name': invite.group.name,
            'emoji': invite.group.emoji,
            'member_count': invite.group.memberships.count(),
        },
    }


def _serialize_challenge(challenge):
    now = timezone.now()
    if challenge.ends_at < now:
        state = 'ended'
    elif challenge.starts_at > now:
        state = 'upcoming'
    else:
        state = 'active'
    return {
        'id': challenge.id,
        'group_id': challenge.group_id,
        'title': challenge.title,
        'metric': challenge.metric,
        'metric_label': service.METRIC_LABELS.get(challenge.metric, challenge.metric),
        'target': challenge.target,
        'starts_at': challenge.starts_at.isoformat(),
        'ends_at': challenge.ends_at.isoformat(),
        'created_at': challenge.created_at.isoformat(),
        'state': state,
        'participant_count': challenge.participants.count(),
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search_users(request):
    q = (request.query_params.get('q') or '').strip()
    if len(q) < 2:
        return Response({'results': []})

    friend_ids = service.friend_user_ids(request.user)
    excluded = friend_ids | {request.user.id}

    users = User.objects.filter(
        Q(name__icontains=q) | Q(email__icontains=q),
    ).exclude(id__in=excluded).order_by('name', 'email')[:20]

    results = []
    for user in users:
        fs = _friendship_status(request.user, user.id)
        status_label = None
        request_id = None
        if fs:
            status_label = fs.status
            if fs.status == Friendship.STATUS_PENDING:
                request_id = fs.id
        results.append({
            **service.serialize_user_brief(user, request),
            'friendship_status': status_label,
            'request_id': request_id,
        })

    return Response({'results': results})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_friends(request):
    friendships = Friendship.objects.filter(
        Q(requester=request.user) | Q(addressee=request.user),
        status=Friendship.STATUS_ACCEPTED,
    ).select_related('requester', 'addressee').order_by('-responded_at', '-created_at')

    friends = []
    for f in friendships:
        other = f.addressee if f.requester_id == request.user.id else f.requester
        friends.append({
            **service.serialize_user_brief(other, request),
            'friends_since': (f.responded_at or f.created_at).isoformat(),
        })

    return Response({'friends': friends})


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def friend_requests(request):
    if request.method == 'GET':
        pending = Friendship.objects.filter(
            Q(requester=request.user) | Q(addressee=request.user),
            status=Friendship.STATUS_PENDING,
        ).select_related('requester', 'addressee').order_by('-created_at')

        incoming = []
        outgoing = []
        for f in pending:
            payload = _serialize_friendship_request(f, request.user)
            if payload['direction'] == 'incoming':
                incoming.append(payload)
            else:
                outgoing.append(payload)

        return Response({'incoming': incoming, 'outgoing': outgoing})

    user_id = request.data.get('user_id')
    if not user_id:
        return Response({'error': 'user_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        target = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

    if target.id == request.user.id:
        return Response({'error': 'You cannot add yourself.'}, status=status.HTTP_400_BAD_REQUEST)

    if service.are_friends(request.user, target):
        return Response({'error': 'Already friends.'}, status=status.HTTP_400_BAD_REQUEST)

    existing = _friendship_status(request.user, target.id)
    if existing:
        if existing.status == Friendship.STATUS_PENDING:
            if existing.addressee_id == request.user.id:
                # The other person had already requested us — this is a mutual add.
                existing.status = Friendship.STATUS_ACCEPTED
                existing.responded_at = timezone.now()
                existing.save(update_fields=['status', 'responded_at'])
                service.notify_friend_accepted(actor=request.user, recipient=existing.requester)
                return Response({
                    'status': 'accepted',
                    'friend': service.serialize_user_brief(target, request),
                })
            return Response({'error': 'Request already sent.'}, status=status.HTTP_400_BAD_REQUEST)
        if existing.status == Friendship.STATUS_DECLINED:
            if existing.requester_id == request.user.id:
                existing.status = Friendship.STATUS_PENDING
                existing.responded_at = None
                existing.save(update_fields=['status', 'responded_at'])
                service.notify_friend_request(actor=request.user, recipient=target, request_id=existing.id)
                return Response({
                    'status': 'pending',
                    'request': _serialize_friendship_request(existing, request.user),
                })
            return Response({'error': 'Request was declined.'}, status=status.HTTP_400_BAD_REQUEST)

    friendship = Friendship.objects.create(
        requester=request.user,
        addressee=target,
        status=Friendship.STATUS_PENDING,
    )
    service.notify_friend_request(actor=request.user, recipient=target, request_id=friendship.id)
    return Response({
        'status': 'pending',
        'request': _serialize_friendship_request(friendship, request.user),
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def accept_friend_request(request, request_id):
    try:
        friendship = Friendship.objects.select_related('requester', 'addressee').get(pk=request_id)
    except Friendship.DoesNotExist:
        return Response({'error': 'Request not found.'}, status=status.HTTP_404_NOT_FOUND)

    if friendship.addressee_id != request.user.id:
        return Response({'error': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)
    if friendship.status != Friendship.STATUS_PENDING:
        return Response({'error': 'Request is not pending.'}, status=status.HTTP_400_BAD_REQUEST)

    friendship.status = Friendship.STATUS_ACCEPTED
    friendship.responded_at = timezone.now()
    friendship.save(update_fields=['status', 'responded_at'])

    service.notify_friend_accepted(actor=request.user, recipient=friendship.requester)

    return Response({
        'status': 'accepted',
        'friend': service.serialize_user_brief(friendship.requester, request),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def decline_friend_request(request, request_id):
    try:
        friendship = Friendship.objects.get(pk=request_id)
    except Friendship.DoesNotExist:
        return Response({'error': 'Request not found.'}, status=status.HTTP_404_NOT_FOUND)

    if friendship.addressee_id != request.user.id:
        return Response({'error': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)
    if friendship.status != Friendship.STATUS_PENDING:
        return Response({'error': 'Request is not pending.'}, status=status.HTTP_400_BAD_REQUEST)

    friendship.status = Friendship.STATUS_DECLINED
    friendship.responded_at = timezone.now()
    friendship.save(update_fields=['status', 'responded_at'])

    service.notify_friend_declined(actor=request.user, recipient=friendship.requester)

    return Response({'status': 'declined'})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def remove_friend(request, user_id):
    friendship = Friendship.objects.filter(
        Q(requester=request.user, addressee_id=user_id) | Q(requester_id=user_id, addressee=request.user),
        status=Friendship.STATUS_ACCEPTED,
    ).first()
    if not friendship:
        return Response({'error': 'Friendship not found.'}, status=status.HTTP_404_NOT_FOUND)

    friendship.delete()
    return Response({'status': 'removed'})


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def groups_list_create(request):
    if request.method == 'GET':
        group_ids = GroupMembership.objects.filter(user=request.user).values_list('group_id', flat=True)
        groups = Group.objects.filter(id__in=group_ids).order_by('-created_at')
        return Response({
            'groups': [_serialize_group_summary(g, request) for g in groups],
        })

    name = (request.data.get('name') or '').strip()
    emoji = (request.data.get('emoji') or 'people').strip() or 'people'
    member_ids = request.data.get('member_ids') or []

    if not name:
        return Response({'error': 'name is required.'}, status=status.HTTP_400_BAD_REQUEST)

    friend_ids = service.friend_user_ids(request.user)
    invalid = [uid for uid in member_ids if uid not in friend_ids]
    if invalid:
        return Response({'error': 'All members must be your friends.'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        group = Group.objects.create(name=name, emoji=emoji, owner=request.user)
        GroupMembership.objects.create(
            group=group, user=request.user, role=GroupMembership.ROLE_OWNER,
        )
        for uid in set(member_ids):
            if uid != request.user.id:
                GroupInvite.objects.create(
                    group=group, invited_user_id=uid, invited_by=request.user,
                )

    return Response(_serialize_group_detail(group, request), status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def group_detail(request, group_id):
    group, membership = service.get_group_for_member(group_id, request.user)
    if not group:
        return Response({'error': 'Group not found.'}, status=status.HTTP_404_NOT_FOUND)

    return Response(_serialize_group_detail(group, request))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def group_add_members(request, group_id):
    """Invite friends to a group. Invitees must accept before joining."""
    group, membership = service.get_group_for_member(group_id, request.user)
    if not group:
        return Response({'error': 'Group not found.'}, status=status.HTTP_404_NOT_FOUND)

    user_ids = request.data.get('user_ids') or []
    friend_ids = service.friend_user_ids(request.user)
    invalid = [uid for uid in user_ids if uid not in friend_ids]
    if invalid:
        return Response({'error': 'You can only invite your friends.'}, status=status.HTTP_400_BAD_REQUEST)

    existing_members = set(group.memberships.values_list('user_id', flat=True))
    invited = []
    for uid in set(user_ids):
        if uid in existing_members:
            continue
        invite, created = GroupInvite.objects.get_or_create(
            group=group,
            invited_user_id=uid,
            defaults={'invited_by': request.user, 'status': GroupInvite.STATUS_PENDING},
        )
        if not created and invite.status != GroupInvite.STATUS_PENDING:
            invite.status = GroupInvite.STATUS_PENDING
            invite.invited_by = request.user
            invite.responded_at = None
            invite.save(update_fields=['status', 'invited_by', 'responded_at'])
        invited.append(uid)

    return Response({'invited': invited, 'group': _serialize_group_detail(group, request)})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def group_invites(request):
    """List the requesting user's pending group invitations."""
    invites = GroupInvite.objects.filter(
        invited_user=request.user,
        status=GroupInvite.STATUS_PENDING,
    ).select_related('group', 'invited_by').order_by('-created_at')

    return Response({
        'invites': [_serialize_group_invite(inv, request) for inv in invites],
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def accept_group_invite(request, invite_id):
    try:
        invite = GroupInvite.objects.select_related('group').get(pk=invite_id)
    except GroupInvite.DoesNotExist:
        return Response({'error': 'Invite not found.'}, status=status.HTTP_404_NOT_FOUND)

    if invite.invited_user_id != request.user.id:
        return Response({'error': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)
    if invite.status != GroupInvite.STATUS_PENDING:
        return Response({'error': 'Invite is not pending.'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        invite.status = GroupInvite.STATUS_ACCEPTED
        invite.responded_at = timezone.now()
        invite.save(update_fields=['status', 'responded_at'])
        GroupMembership.objects.get_or_create(
            group=invite.group,
            user=request.user,
            defaults={'role': GroupMembership.ROLE_MEMBER},
        )
        _enroll_in_active_challenges(invite.group, request.user)

    return Response({'status': 'accepted', 'group_id': invite.group_id})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def decline_group_invite(request, invite_id):
    try:
        invite = GroupInvite.objects.get(pk=invite_id)
    except GroupInvite.DoesNotExist:
        return Response({'error': 'Invite not found.'}, status=status.HTTP_404_NOT_FOUND)

    if invite.invited_user_id != request.user.id:
        return Response({'error': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)
    if invite.status != GroupInvite.STATUS_PENDING:
        return Response({'error': 'Invite is not pending.'}, status=status.HTTP_400_BAD_REQUEST)

    invite.status = GroupInvite.STATUS_DECLINED
    invite.responded_at = timezone.now()
    invite.save(update_fields=['status', 'responded_at'])

    return Response({'status': 'declined'})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def cancel_group_invite(request, group_id, invite_id):
    """Owner cancels a pending invite."""
    group, membership = service.get_group_for_member(group_id, request.user)
    if not group:
        return Response({'error': 'Group not found.'}, status=status.HTTP_404_NOT_FOUND)
    if membership.role != GroupMembership.ROLE_OWNER:
        return Response({'error': 'Only the owner can cancel invites.'}, status=status.HTTP_403_FORBIDDEN)

    deleted = group.invites.filter(id=invite_id, status=GroupInvite.STATUS_PENDING).delete()
    if not deleted[0]:
        return Response({'error': 'Invite not found.'}, status=status.HTTP_404_NOT_FOUND)

    return Response({'status': 'cancelled'})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def group_remove_member(request, group_id, user_id):
    group, membership = service.get_group_for_member(group_id, request.user)
    if not group:
        return Response({'error': 'Group not found.'}, status=status.HTTP_404_NOT_FOUND)

    if user_id == request.user.id:
        if membership.role == GroupMembership.ROLE_OWNER:
            other_members = group.memberships.exclude(user=request.user).count()
            if other_members > 0:
                return Response(
                    {'error': 'Transfer ownership or delete the group before leaving.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            group.delete()
            return Response({'status': 'group_deleted'})
        group.memberships.filter(user=request.user).delete()
        return Response({'status': 'left'})

    if membership.role != GroupMembership.ROLE_OWNER:
        return Response({'error': 'Only the owner can remove members.'}, status=status.HTTP_403_FORBIDDEN)

    removed = group.memberships.filter(user_id=user_id).delete()
    if not removed[0]:
        return Response({'error': 'Member not found.'}, status=status.HTTP_404_NOT_FOUND)

    return Response({'status': 'removed'})


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def group_challenges(request, group_id):
    group, membership = service.get_group_for_member(group_id, request.user)
    if not group:
        return Response({'error': 'Group not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        challenges = group.challenges.all()
        return Response({
            'challenges': [_serialize_challenge(c) for c in challenges],
        })

    title = (request.data.get('title') or '').strip()
    metric = request.data.get('metric')
    target = request.data.get('target')
    ends_at = _parse_datetime(request.data.get('ends_at'))
    # The device sends absolute instants derived from its local time zone
    # (most reliable). Fall back to server "now" only if the client omits it.
    starts_at = _parse_datetime(request.data.get('starts_at')) or timezone.now()

    valid_metrics = {c[0] for c in GroupChallenge.METRIC_CHOICES}
    if not title:
        return Response({'error': 'title is required.'}, status=status.HTTP_400_BAD_REQUEST)
    if metric not in valid_metrics:
        return Response({'error': 'Invalid metric.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        target = int(target)
        if target <= 0:
            raise ValueError
    except (TypeError, ValueError):
        return Response({'error': 'target must be a positive integer.'}, status=status.HTTP_400_BAD_REQUEST)
    if not ends_at or ends_at <= timezone.now():
        return Response({'error': 'ends_at must be in the future.'}, status=status.HTTP_400_BAD_REQUEST)
    if ends_at <= starts_at:
        return Response({'error': 'ends_at must be after starts_at.'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        challenge = GroupChallenge.objects.create(
            group=group,
            created_by=request.user,
            title=title,
            metric=metric,
            target=target,
            starts_at=starts_at,
            ends_at=ends_at,
        )
        for m in group.memberships.select_related('user'):
            baseline = service.current_metric_value(m.user, metric) if service.uses_baseline(metric) else 0
            ChallengeParticipant.objects.create(
                challenge=challenge,
                user=m.user,
                baseline_value=baseline,
            )

    return Response(_serialize_challenge(challenge), status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def group_leaderboard(request, group_id):
    group, membership = service.get_group_for_member(group_id, request.user)
    if not group:
        return Response({'error': 'Group not found.'}, status=status.HTTP_404_NOT_FOUND)

    members = list(group.memberships.select_related('user'))
    from courses.views import get_or_create_stats

    rows = []
    for m in members:
        stats = get_or_create_stats(m.user)
        rows.append((m.user, stats.xp))

    rows.sort(key=lambda r: (-r[1], r[0].date_joined))
    top = [
        service.serialize_leaderboard_entry(
            user, i + 1, xp, request, is_me=user.id == request.user.id,
        )
        for i, (user, xp) in enumerate(rows)
    ]

    me = next((e for e in top if e['is_me']), None)

    return Response({
        'group_id': group.id,
        'group_name': group.name,
        'total_members': len(rows),
        'top': top,
        'me': me,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def challenge_leaderboard(request, challenge_id):
    try:
        challenge = GroupChallenge.objects.select_related('group').get(pk=challenge_id)
    except GroupChallenge.DoesNotExist:
        return Response({'error': 'Challenge not found.'}, status=status.HTTP_404_NOT_FOUND)

    _, membership = service.get_group_for_member(challenge.group_id, request.user)
    if not membership:
        return Response({'error': 'Not a group member.'}, status=status.HTTP_403_FORBIDDEN)

    participants = list(
        challenge.participants.select_related('user').all(),
    )

    scored = []
    for p in participants:
        prog = service.compute_progress(p)
        scored.append((p, prog['progress'], prog['percent']))

    scored.sort(key=lambda r: (-r[1], -r[2], r[0].user.date_joined))

    top = [
        service.serialize_challenge_entry(
            p, i + 1, request, is_me=p.user_id == request.user.id,
        )
        for i, (p, _, _) in enumerate(scored)
    ]

    me = next((e for e in top if e['is_me']), None)

    return Response({
        'challenge': _serialize_challenge(challenge),
        'total_participants': len(scored),
        'top': top,
        'me': me,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def notifications_list(request):
    """Recent notifications for the current user plus the unread count."""
    qs = Notification.objects.filter(recipient=request.user).select_related('actor')
    unread_count = qs.filter(is_read=False).count()
    items = [service.serialize_notification(n) for n in qs[:NOTIFICATIONS_PAGE_SIZE]]
    return Response({'notifications': items, 'unread_count': unread_count})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def notifications_unread_count(request):
    """Lightweight endpoint for badge polling."""
    count = Notification.objects.filter(recipient=request.user, is_read=False).count()
    return Response({'unread_count': count})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_notification_read(request, notification_id):
    updated = Notification.objects.filter(
        id=notification_id, recipient=request.user, is_read=False,
    ).update(is_read=True)
    if not updated:
        # Idempotent: already read or not found for this user.
        exists = Notification.objects.filter(id=notification_id, recipient=request.user).exists()
        if not exists:
            return Response({'error': 'Notification not found.'}, status=status.HTTP_404_NOT_FOUND)
    count = Notification.objects.filter(recipient=request.user, is_read=False).count()
    return Response({'status': 'ok', 'unread_count': count})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_all_notifications_read(request):
    Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
    return Response({'status': 'ok', 'unread_count': 0})


@api_view(['POST', 'DELETE'])
@permission_classes([IsAuthenticated])
def push_token(request):
    """Register (POST) or unregister (DELETE) an Expo push token for this user."""
    token = (request.data.get('token') or '').strip()
    if not token:
        return Response({'error': 'token is required.'}, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'DELETE':
        DeviceToken.objects.filter(token=token).delete()
        return Response({'status': 'unregistered'})

    platform = (request.data.get('platform') or '').strip().lower()
    if platform not in {DeviceToken.PLATFORM_IOS, DeviceToken.PLATFORM_ANDROID}:
        platform = ''

    # A token is unique per device; move it to the current user if it was
    # previously registered by someone else on the same device.
    DeviceToken.objects.update_or_create(
        token=token,
        defaults={'user': request.user, 'platform': platform},
    )
    return Response({'status': 'registered'})
