"""Build https-safe absolute media URLs for mobile clients."""
from django.conf import settings


def absolute_media_url(file_field, request=None):
    if not file_field:
        return None
    url = file_field.url
    if request:
        absolute = request.build_absolute_uri(url)
        if absolute.startswith('http://') and not settings.DEBUG:
            return 'https://' + absolute[len('http://'):]
        return absolute
    domain = getattr(settings, 'RAILWAY_PUBLIC_DOMAIN', '') or ''
    if domain:
        path = url if url.startswith('/') else f'/{url}'
        return f'https://{domain}{path}'
    return url
