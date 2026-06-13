"""Verify Apple identity tokens issued by Sign in with Apple."""

import jwt
import requests
from django.conf import settings

APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys'
APPLE_ISSUER = 'https://appleid.apple.com'


def _get_apple_public_key(kid: str):
    response = requests.get(APPLE_KEYS_URL, timeout=10)
    response.raise_for_status()
    keys = response.json().get('keys', [])
    jwk = next((key for key in keys if key.get('kid') == kid), None)
    if not jwk:
        raise ValueError('Apple public key not found')
    return jwt.algorithms.RSAAlgorithm.from_jwk(jwk)


def verify_apple_identity_token(token_str: str) -> dict:
    """Return verified Apple ID token claims or raise ValueError."""
    allowed_client_ids = settings.APPLE_CLIENT_IDS
    if not allowed_client_ids:
        raise ValueError('Apple sign-in is not configured on the server.')

    header = jwt.get_unverified_header(token_str)
    public_key = _get_apple_public_key(header['kid'])

    last_error = None
    for client_id in allowed_client_ids:
        try:
            return jwt.decode(
                token_str,
                public_key,
                algorithms=['RS256'],
                audience=client_id,
                issuer=APPLE_ISSUER,
            )
        except jwt.InvalidAudienceError as exc:
            last_error = exc
            continue

    raise ValueError('Apple token was issued for a different app.') from last_error
