"""Helpers for invite-gated account creation."""

from django.conf import settings


def join_base_url():
    return getattr(settings, 'INVITE_JOIN_BASE_URL', 'https://getmoneybot.com/join').rstrip('/')
