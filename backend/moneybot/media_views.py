"""Serve /media/ with long-lived cache headers for character assets."""
from django.conf import settings
from django.views.static import serve as django_serve

IMMUTABLE_EXTENSIONS = {'.glb', '.png', '.jpg', '.jpeg', '.webp', '.gif'}
IMMUTABLE_CACHE = 'public, max-age=31536000, immutable'
BADGE_CACHE = 'public, max-age=3600'


def serve_media(request, path, document_root=None):
    document_root = document_root or settings.MEDIA_ROOT
    response = django_serve(request, path, document_root=document_root)
    lower_path = path.lower()
    is_badge = '/badges/' in lower_path or lower_path.startswith('badges/')
    is_character = '/characters/' in lower_path or lower_path.startswith('characters/')
    if is_badge:
        response['Cache-Control'] = BADGE_CACHE
    elif is_character:
        ext = '.' + lower_path.rsplit('.', 1)[-1] if '.' in lower_path else ''
        if ext in IMMUTABLE_EXTENSIONS:
            response['Cache-Control'] = IMMUTABLE_CACHE
    return response
