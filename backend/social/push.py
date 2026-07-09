"""Expo push notification delivery.

Sends remote push notifications through Expo's push service so users get
notified even when the app is closed. Best-effort: failures never bubble up
into the request flow that triggered them.

Requires the device's Expo push token (registered by the mobile app) and, for
iOS delivery, an APNs key configured in the project's Expo/EAS credentials.
"""
import logging

import requests

from .models import DeviceToken

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
_REQUEST_TIMEOUT = 8


def _looks_like_expo_token(token):
    return bool(token) and token.startswith(('ExponentPushToken[', 'ExpoPushToken['))


def send_expo_push(tokens, title, body, data=None):
    """Send a push to a list of Expo tokens. Returns the number attempted."""
    messages = [
        {
            'to': token,
            'title': title,
            'body': body,
            'sound': 'default',
            'data': data or {},
            'priority': 'high',
        }
        for token in tokens
        if _looks_like_expo_token(token)
    ]
    if not messages:
        return 0

    try:
        resp = requests.post(
            EXPO_PUSH_URL,
            json=messages,
            headers={
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            timeout=_REQUEST_TIMEOUT,
        )
        _handle_receipts(resp, messages)
    except requests.RequestException as exc:
        logger.warning('Expo push request failed: %s', exc)
        return 0
    return len(messages)


def _handle_receipts(resp, messages):
    """Remove tokens Expo reports as unregistered so we stop pushing to them."""
    try:
        payload = resp.json()
    except ValueError:
        return
    data = payload.get('data')
    if not isinstance(data, list):
        return
    dead = []
    for message, receipt in zip(messages, data):
        if receipt.get('status') == 'error':
            details = receipt.get('details') or {}
            if details.get('error') == 'DeviceNotRegistered':
                dead.append(message['to'])
    if dead:
        DeviceToken.objects.filter(token__in=dead).delete()


def push_to_user(user, title, body, data=None):
    """Send a push to all of a user's registered devices. Best-effort."""
    if user is None:
        return 0
    tokens = list(
        DeviceToken.objects.filter(user=user).values_list('token', flat=True)
    )
    if not tokens:
        return 0
    try:
        return send_expo_push(tokens, title, body, data=data)
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning('push_to_user failed for user %s: %s', getattr(user, 'id', '?'), exc)
        return 0
