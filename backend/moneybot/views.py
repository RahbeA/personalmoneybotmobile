from django.conf import settings
from django.http import HttpResponse, HttpResponseRedirect
from django.shortcuts import render

from .legal_content import LEGAL_DOCUMENTS, LEGAL_META


def legal_document(request, doc_id):
    """Render a public legal page (privacy / terms) for Apple + in-app links."""
    doc = LEGAL_DOCUMENTS.get(doc_id)
    if doc is None:
        return HttpResponseRedirect('/legal/privacy/')
    return render(request, 'legal.html', {'doc': doc, 'meta': LEGAL_META})


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
