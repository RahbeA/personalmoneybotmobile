from django.conf import settings
from django.http import HttpResponse


def panel_index(request, path=''):
    """Serve the built control-panel SPA so client-side routing works.

    The Vite build emits its hashed JS/CSS into web/dist (served by WhiteNoise at
    /static/panel/). This view returns the SPA's index.html for every /panel/* URL
    so React Router can handle the route in the browser.
    """
    index_file = settings.WEB_DIST / 'index.html'
    if not index_file.exists():
        return HttpResponse(
            '<h1>Control panel not built</h1>'
            '<p>Run <code>npm install && npm run build</code> in the <code>web/</code> '
            'folder, then <code>python manage.py collectstatic</code>.</p>',
            content_type='text/html',
            status=503,
        )
    return HttpResponse(index_file.read_text(encoding='utf-8'), content_type='text/html')
