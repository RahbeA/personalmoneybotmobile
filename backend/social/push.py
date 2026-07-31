"""Expo push notification delivery.

Sends remote push notifications through Expo's push service so users get
notified even when the app is closed.

Requires the device's Expo push token (registered by the mobile app) and, for
iOS delivery, an APNs key configured in the project's Expo/EAS credentials.

If the Expo project has "Push Security" enabled, set EXPO_ACCESS_TOKEN in the
backend environment so requests are authorized.
"""
import logging
from dataclasses import dataclass, field

import requests
from django.conf import settings

from .models import DeviceToken

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
_REQUEST_TIMEOUT = 15
_EXPO_BATCH_SIZE = 100


@dataclass
class PushResult:
    attempted: int = 0
    accepted: int = 0
    errors: list = field(default_factory=list)
    dead_tokens: list = field(default_factory=list)

    @property
    def ok(self):
        return self.accepted > 0 and not self.errors

    def summary(self):
        parts = [f'{self.accepted}/{self.attempted} accepted by Expo']
        if self.errors:
            parts.append(self.errors[0][:240])
        if self.dead_tokens:
            parts.append(f'{len(self.dead_tokens)} dead token(s) pruned')
        return '; '.join(parts)


def _looks_like_expo_token(token):
    return bool(token) and token.startswith(('ExponentPushToken[', 'ExpoPushToken['))


def _expo_headers():
    headers = {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
    }
    access_token = (getattr(settings, 'EXPO_ACCESS_TOKEN', '') or '').strip()
    if access_token:
        headers['Authorization'] = f'Bearer {access_token}'
    return headers


def send_expo_push(tokens, title, body, data=None, *, raise_on_failure=False):
    """Send pushes in Expo-supported batches.

    Returns a PushResult. When raise_on_failure is True and nothing is accepted
    (or the HTTP call fails), raises RuntimeError with a useful message so
    admin campaigns can surface the failure.
    """
    payload_data = data or {}
    valid_tokens = [t for t in tokens if _looks_like_expo_token(t)]
    skipped = len(tokens) - len(valid_tokens)

    result = PushResult()
    if skipped:
        result.errors.append(f'{skipped} token(s) were not valid Expo push tokens')

    if not valid_tokens:
        if raise_on_failure:
            raise RuntimeError(
                'No valid Expo push tokens for this audience. '
                'Users must open the app on a physical device and allow notifications.'
            )
        return result

    messages = [
        {
            'to': token,
            'title': title,
            'body': body,
            'sound': 'default',
            'data': payload_data,
            'priority': 'high',
            # Android 8+ requires a channel; match the mobile "social" channel.
            'channelId': 'social',
            'badge': 1,
        }
        for token in valid_tokens
    ]

    http_failures = 0
    for offset in range(0, len(messages), _EXPO_BATCH_SIZE):
        batch = messages[offset:offset + _EXPO_BATCH_SIZE]
        result.attempted += len(batch)
        try:
            resp = requests.post(
                EXPO_PUSH_URL,
                json=batch,
                headers=_expo_headers(),
                timeout=_REQUEST_TIMEOUT,
            )
            if resp.status_code >= 400:
                detail = resp.text[:500]
                logger.warning('Expo push HTTP %s: %s', resp.status_code, detail)
                result.errors.append(f'Expo HTTP {resp.status_code}: {detail}')
                http_failures += 1
                continue

            batch_accepted, batch_errors, dead = _process_tickets(resp, batch)
            result.accepted += batch_accepted
            result.errors.extend(batch_errors)
            result.dead_tokens.extend(dead)
        except requests.RequestException as exc:
            logger.warning('Expo push batch failed: %s', exc)
            result.errors.append(f'Expo request failed: {exc}')
            http_failures += 1

    if result.dead_tokens:
        DeviceToken.objects.filter(token__in=result.dead_tokens).delete()

    if raise_on_failure and result.accepted == 0:
        raise RuntimeError(
            result.summary()
            or 'Expo accepted 0 push tickets. Check EXPO_ACCESS_TOKEN and EAS push credentials.'
        )

    if raise_on_failure and http_failures and result.accepted == 0:
        raise RuntimeError(result.summary())

    return result


def _process_tickets(resp, messages):
    """Parse Expo push tickets; return (accepted, errors, dead_tokens)."""
    try:
        payload = resp.json()
    except ValueError:
        return 0, ['Expo returned a non-JSON response'], []

    # Expo may wrap errors as {"errors":[{"message":"..."}]}
    top_errors = payload.get('errors')
    if isinstance(top_errors, list) and top_errors:
        msgs = [e.get('message') or str(e) for e in top_errors]
        return 0, msgs, []

    data = payload.get('data')
    if not isinstance(data, list):
        return 0, ['Unexpected Expo push response shape'], []

    accepted = 0
    errors = []
    dead = []
    for message, ticket in zip(messages, data):
        status = ticket.get('status')
        if status == 'ok':
            accepted += 1
            continue
        details = ticket.get('details') or {}
        err_code = details.get('error') or ticket.get('message') or 'unknown'
        if details.get('error') == 'DeviceNotRegistered':
            dead.append(message['to'])
        else:
            errors.append(f'{err_code}')
            logger.warning(
                'Expo push ticket error for %s: %s (%s)',
                message['to'][:32],
                ticket.get('message'),
                err_code,
            )
    return accepted, errors[:5], dead


# Back-compat helper used by friend notification paths — returns accepted count.
def send_expo_push_count(tokens, title, body, data=None):
    return send_expo_push(tokens, title, body, data=data).accepted


def push_to_user(user, title, body, data=None):
    """Send a push to all of a user's registered devices. Best-effort."""
    if user is None:
        return 0
    tokens = list(
        DeviceToken.objects.filter(user=user).values_list('token', flat=True)
    )
    if not tokens:
        logger.info(
            'push_to_user: no DeviceToken for user %s — skipping remote push',
            getattr(user, 'id', '?'),
        )
        return 0
    try:
        return send_expo_push(tokens, title, body, data=data).accepted
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning('push_to_user failed for user %s: %s', getattr(user, 'id', '?'), exc)
        return 0
