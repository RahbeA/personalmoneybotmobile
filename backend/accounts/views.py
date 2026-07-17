from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from .apple_auth import verify_apple_identity_token
from .serializers import RegisterSerializer, LoginSerializer, UserSerializer

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
    if guest is not None:
        # Upgrade the existing guest account in place, keeping all their progress.
        data = serializer.validated_data
        guest.email = User.objects.normalize_email(data['email'])
        guest.set_password(data['password'])
        if data.get('name'):
            guest.name = data['name']
        guest.is_guest = False
        guest.save()
        token, _ = Token.objects.get_or_create(user=guest)
        return Response(
            {'token': token.key, 'user': UserSerializer(guest).data},
            status=status.HTTP_200_OK,
        )

    user = serializer.save()
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
        # Passing no audience here lets us accept any of our configured client
        # IDs (web/iOS/Android), which all produce tokens for the same project.
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

    user = User.objects.filter(google_id=google_sub).first()
    if user is None:
        # Link to an existing email/password account if one exists, otherwise
        # upgrade the current guest (preserving progress), or create a new user.
        user = User.objects.filter(email=email).first()
        if user is None:
            if guest is not None:
                user = guest
                user.email = email
                user.is_guest = False
            else:
                user = User.objects.create_user(email=email, password=None)
        user.google_id = google_sub

    # Keep profile details fresh from Google.
    if name:
        user.name = name
    if avatar_url:
        user.avatar_url = avatar_url
    user.save()

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

    user = User.objects.filter(apple_id=apple_sub).first()
    if user is None and email:
        user = User.objects.filter(email=email).first()

    if user is None:
        if guest is not None:
            # Upgrade the current guest, preserving progress. Apple's private-relay
            # flow may omit the email on repeat sign-ins, which is fine here since
            # the Apple identifier is what anchors the account.
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
