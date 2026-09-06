from django.conf import settings
from django.http import HttpResponse, HttpResponseRedirect, JsonResponse
from django.shortcuts import render

from .legal_content import LEGAL_DOCUMENTS, LEGAL_META


def app_version(request):
    """Public config the mobile app polls on launch to decide whether to force an update.

    `min_supported_version` empty ⇒ the client leaves the gate disabled.
    """
    return JsonResponse({
        'min_supported_version': settings.MIN_SUPPORTED_APP_VERSION,
        'latest_version': settings.LATEST_APP_VERSION,
        'ios_url': settings.IOS_APP_STORE_URL,
        'android_url': settings.ANDROID_STORE_URL,
    })


def legal_document(request, doc_id):
    """Render a public legal page (privacy / terms) for Apple + in-app links."""
    doc = LEGAL_DOCUMENTS.get(doc_id)
    if doc is None:
        return HttpResponseRedirect('/legal/privacy/')
    return render(request, 'legal.html', {'doc': doc, 'meta': LEGAL_META})


def join_invite(request, code):
    """Public join page: show invite code + store links for manual app entry."""
    from accounts.models import Invite

    normalized = Invite.normalize_code(code)
    invite = (
        Invite.objects.select_related('created_by').filter(code=normalized).first()
        if normalized else None
    )

    if invite is None:
        state = 'invalid'
        inviter_name = None
    elif invite.is_revoked:
        state = 'invalid'
        inviter_name = None
    elif invite.used_by_id:
        state = 'used'
        inviter = invite.created_by
        inviter_name = None
        if inviter is not None:
            inviter_name = (inviter.name or '').strip() or (
                (inviter.email or '').split('@')[0] if inviter.email else None
            )
    else:
        state = 'valid'
        inviter = invite.created_by
        inviter_name = None
        if inviter is not None:
            inviter_name = (inviter.name or '').strip() or (
                (inviter.email or '').split('@')[0] if inviter.email else None
            )

    return render(request, 'join.html', {
        'code': normalized or code,
        'state': state,
        'inviter_name': inviter_name,
        'app_store_url': 'https://apps.apple.com/app/id6778658807',
        'play_store_url': 'https://play.google.com/store/apps/details?id=com.moneybot.app',
    })


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
