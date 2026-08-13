from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.db import transaction
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .apple_auth import verify_apple_identity_token
from .invites import join_base_url
from .models import (
    Invite,
    InviteClaim,
    InviteError,
    ensure_user_invites,
    get_or_create_personal_invite,
    invite_only_enabled,
)
from .rewards import reward_inviter_for_signup
from .serializers import LoginSerializer, RegisterSerializer, UserSerializer

User = get_user_model()


def _current_guest(request):
    """Return the authenticated user only if it's an anonymous guest.

    Auth endpoints are AllowAny, but DRF still resolves a bearer token if one is
    sent. When a guest hits register/google/apple we upgrade that same account in
    place so their progress carries over.
    """
    user = getattr(request, 'user', None)
    if user is not None and user.is_authenticated and getattr(user, 'is_guest', False):
        return user
    return None


def _invite_code_from_request(request):
    return (
        request.data.get('invite_code')
        or request.data.get('inviteCode')
        or request.data.get('code')
        or ''
    )


def _claim_invite_if_needed(request, user, *, is_new_account):
    """Claim invite atomically when invite-only is on and this is a new real account.

    Returns the claimed Invite (so the caller can reward the inviter) or None.
    """
    if not is_new_account:
        return None
    if not invite_only_enabled():
        return None
    return Invite.claim(_invite_code_from_request(request), user)


def _invite_error_response(exc):
    return Response(
        {'detail': exc.detail, 'code': exc.code},
        status=status.HTTP_400_BAD_REQUEST,
    )


@api_view(['POST'])
@permission_classes([AllowAny])
def guest_auth(request):
    """Create an anonymous guest session so users can explore without signing up."""
    user = User.objects.create_guest_user()
    token, _ = Token.objects.get_or_create(user=user)
    return Response(
        {
            'token': token.key,
            'user': UserSerializer(user).data,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    guest = _current_guest(request)
    try:
        with transaction.atomic():
            if guest is not None:
                data = serializer.validated_data
                guest.email = User.objects.normalize_email(data['email'])
                guest.set_password(data['password'])
                if data.get('name'):
                    guest.name = data['name']
                guest.is_guest = False
                guest.save()
                user = guest
                status_code = status.HTTP_200_OK
            else:
                user = serializer.save()
                status_code = status.HTTP_201_CREATED

            claimed_invite = _claim_invite_if_needed(request, user, is_new_account=True)
            ensure_user_invites(user)
    except InviteError as exc:
        return _invite_error_response(exc)

    if claimed_invite is not None:
        reward_inviter_for_signup(claimed_invite, user)

    token, _ = Token.objects.get_or_create(user=user)
    return Response(
        {'token': token.key, 'user': UserSerializer(user).data},
        status=status_code,
    )


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    serializer = LoginSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    email = serializer.validated_data['email']
    password = serializer.validated_data['password']

    user = authenticate(request, username=email, password=password)
    if not user:
        return Response(
            {'detail': 'Invalid email or password.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    token, _ = Token.objects.get_or_create(user=user)
    return Response({
        'token': token.key,
        'user': UserSerializer(user).data,
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def google_auth(request):
    """Authenticate (or register) a user from a Google ID token.

    The mobile client obtains an ID token via expo-auth-session and POSTs it as
    {"id_token": "..."}. We verify the token's signature/audience against Google,
    then get-or-create a matching local user and return the same {token, user}
    shape used by the email/password flows.
    """
    token_str = request.data.get('id_token') or request.data.get('idToken')
    if not token_str:
        return Response(
            {'detail': 'Missing Google id_token.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    allowed_client_ids = settings.GOOGLE_CLIENT_IDS
    if not allowed_client_ids:
        return Response(
            {'detail': 'Google sign-in is not configured on the server.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    try:
        claims = google_id_token.verify_oauth2_token(
            token_str, google_requests.Request()
        )
    except ValueError:
        return Response(
            {'detail': 'Invalid or expired Google token.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if claims.get('aud') not in allowed_client_ids:
        return Response(
            {'detail': 'Google token was issued for a different app.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not claims.get('email_verified', False):
        return Response(
            {'detail': 'Google account email is not verified.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    google_sub = claims['sub']
    email = (claims.get('email') or '').lower()
    name = claims.get('name', '')
    avatar_url = claims.get('picture', '')

    guest = _current_guest(request)

    try:
        with transaction.atomic():
            existing = User.objects.filter(google_id=google_sub).first()
            is_new_account = False

            if existing is not None:
                user = existing
            else:
                user = User.objects.filter(email=email).first()
                if user is None:
                    is_new_account = True
                    if guest is not None:
                        user = guest
                        user.email = email
                        user.is_guest = False
                    else:
                        user = User.objects.create_user(email=email, password=None)
                user.google_id = google_sub

            if name:
                user.name = name
            if avatar_url:
                user.avatar_url = avatar_url
            user.save()

            claimed_invite = _claim_invite_if_needed(request, user, is_new_account=is_new_account)
            if is_new_account:
                ensure_user_invites(user)
    except InviteError as exc:
        return _invite_error_response(exc)

    if claimed_invite is not None:
        reward_inviter_for_signup(claimed_invite, user)

    token, _ = Token.objects.get_or_create(user=user)
    return Response({
        'token': token.key,
        'user': UserSerializer(user).data,
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def apple_auth(request):
    """Authenticate (or register) a user from a Sign in with Apple identity token."""
    token_str = request.data.get('identity_token') or request.data.get('identityToken')
    if not token_str:
        return Response(
            {'detail': 'Missing Apple identity token.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        claims = verify_apple_identity_token(token_str)
    except ValueError as exc:
        return Response({'detail': str(exc)}, status=status.HTTP_401_UNAUTHORIZED)

    apple_sub = claims['sub']
    email = (request.data.get('email') or claims.get('email') or '').lower()
    name = (request.data.get('full_name') or request.data.get('fullName') or '').strip()

    guest = _current_guest(request)

    try:
        with transaction.atomic():
            user = User.objects.filter(apple_id=apple_sub).first()
            is_new_account = False

            if user is None and email:
                user = User.objects.filter(email=email).first()

            if user is None:
                is_new_account = True
                if guest is not None:
                    user = guest
                    if email:
                        user.email = email
                    user.is_guest = False
                elif not email:
                    return Response(
                        {
                            'detail': (
                                'Apple did not provide an email address. '
                                'Use a different sign-in method or revoke MoneyBot in '
                                'Settings > Apple ID > Sign-In & Security and try again.'
                            ),
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                else:
                    user = User.objects.create_user(email=email, password=None)

            user.apple_id = apple_sub
            if name and not user.name:
                user.name = name
            user.save()

            claimed_invite = _claim_invite_if_needed(request, user, is_new_account=is_new_account)
            if is_new_account:
                ensure_user_invites(user)
    except InviteError as exc:
        return _invite_error_response(exc)

    if claimed_invite is not None:
        reward_inviter_for_signup(claimed_invite, user)

    token, _ = Token.objects.get_or_create(user=user)
    return Response({
        'token': token.key,
        'user': UserSerializer(user).data,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    try:
        request.user.auth_token.delete()
    except Exception:
        pass
    return Response({'detail': 'Successfully logged out.'})


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def profile(request):
    """Read the current user's profile, or update editable fields (name)."""
    user = request.user
    if request.method == 'PATCH':
        if 'name' in request.data:
            user.name = (request.data.get('name') or '').strip()[:255]
            user.save(update_fields=['name'])
    return Response(UserSerializer(user).data)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_account(request):
    """Permanently delete the authenticated user's account and all associated data."""
    user = request.user
    if user.is_staff or user.is_superuser:
        return Response(
            {'detail': 'Staff accounts cannot be deleted from the app.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    user.delete()
    return Response({'detail': 'Account deleted successfully.'})


# --- Invite endpoints -------------------------------------------------------

@api_view(['GET'])
@permission_classes([AllowAny])
def invite_status(request):
    """Public flag so Landing/Auth know whether to show the invite code field."""
    return Response({'invite_only_enabled': invite_only_enabled()})


@api_view(['POST'])
@permission_classes([AllowAny])
def invite_validate(request):
    """Soft-validate an invite code before submit (does not claim it)."""
    code = Invite.normalize_code(
        request.data.get('invite_code')
        or request.data.get('inviteCode')
        or request.data.get('code')
        or ''
    )
    if not code:
        return Response({
            'valid': False,
            'reason': 'required',
            'detail': 'Enter an invite code.',
        })

    invite = Invite.objects.select_related('created_by').filter(code=code).first()
    if invite is None:
        return Response({
            'valid': False,
            'reason': 'invalid',
            'detail': 'That invite code is not valid.',
        })
    if invite.is_revoked:
        return Response({
            'valid': False,
            'reason': 'revoked',
            'detail': 'That invite code has been revoked.',
        })
    if invite.remaining <= 0:
        return Response({
            'valid': False,
            'reason': 'used',
            'detail': 'That invite code has already been used up.',
        })

    inviter = invite.created_by
    inviter_name = None
    if inviter is not None:
        inviter_name = (inviter.name or '').strip() or (
            (inviter.email or '').split('@')[0] if inviter.email else None
        )

    return Response({
        'valid': True,
        'inviter_name': inviter_name,
    })


def _serialize_personal_invite(invite):
    """Shape the user's single reusable invite code for the mobile app."""
    claims = (
        InviteClaim.objects.filter(invite=invite)
        .select_related('user')
        .order_by('-created_at', '-id')
    )
    claimed_by = []
    for claim in claims:
        joined = claim.user
        name = (getattr(joined, 'name', '') or '').strip() or (
            (joined.email or '').split('@')[0] if joined and joined.email else 'A friend'
        )
        claimed_by.append({
            'name': name,
            'joined_at': claim.created_at.isoformat() if claim.created_at else None,
        })

    used = invite.uses_count
    total = invite.max_uses
    return {
        'code': invite.code,
        'url': invite.join_url,
        'status': invite.status,
        'used': used,
        'max_uses': total,
        'remaining': invite.remaining,
        'claimed_by': claimed_by,
        'created_at': invite.created_at.isoformat() if invite.created_at else None,
        # Back-compat with the old list-of-codes shape.
        'invites': [{
            'code': invite.code,
            'url': invite.join_url,
            'status': invite.status,
            'used_by_name': claimed_by[0]['name'] if claimed_by else None,
            'used_at': claimed_by[0]['joined_at'] if claimed_by else None,
            'created_at': invite.created_at.isoformat() if invite.created_at else None,
        }],
        'remaining_legacy': invite.remaining,
        'total': total,
        'join_base_url': join_base_url(),
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_invites(request):
    """Return the current user's single reusable invite code (real accounts only)."""
    user = request.user
    if getattr(user, 'is_guest', False):
        return Response(
            {'detail': 'Create a free account to invite friends.', 'code': 'account_required'},
            status=status.HTTP_403_FORBIDDEN,
        )

    invite = get_or_create_personal_invite(user)
    if invite is None:
        return Response(
            {'detail': 'Create a free account to invite friends.', 'code': 'account_required'},
            status=status.HTTP_403_FORBIDDEN,
        )
    payload = _serialize_personal_invite(invite)
    payload['reward_bot_bucks'] = int(getattr(settings, 'INVITE_REWARD_BOT_BUCKS', 50) or 0)
    return Response(payload)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def regenerate_invite(request):
    """Swap the user's reusable code for a fresh one (old link stops working)."""
    user = request.user
    if getattr(user, 'is_guest', False):
        return Response(
            {'detail': 'Create a free account to invite friends.', 'code': 'account_required'},
            status=status.HTTP_403_FORBIDDEN,
        )

    invite = get_or_create_personal_invite(user)
    if invite is None:
        return Response(
            {'detail': 'Create a free account to invite friends.', 'code': 'account_required'},
            status=status.HTTP_403_FORBIDDEN,
        )
    invite.regenerate_code()
    payload = _serialize_personal_invite(invite)
    payload['reward_bot_bucks'] = int(getattr(settings, 'INVITE_REWARD_BOT_BUCKS', 50) or 0)
    return Response(payload)
