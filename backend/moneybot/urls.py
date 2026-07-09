from django.contrib import admin
from django.urls import path, re_path, include
from django.conf import settings

from .views import panel_index, legal_document
from .media_views import serve_media

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/courses/', include('courses.urls')),
    path('api/moneyverse/', include('moneyverse.urls')),
    path('api/ai/', include('ai.urls')),
    path('api/games/', include('games.urls')),
    path('api/daily/', include('daily.urls')),
    path('api/social/', include('social.urls')),
    path('api/admin/', include('adminapi.urls')),
    # Public legal pages (URLs submitted to Apple App Store Connect).
    path('legal/privacy/', legal_document, {'doc_id': 'privacy'}, name='privacy-policy'),
    path('legal/terms/', legal_document, {'doc_id': 'terms'}, name='terms-of-service'),
    path('legal/support/', legal_document, {'doc_id': 'support'}, name='support'),
    re_path(r'^media/(?P<path>.*)$', serve_media, {'document_root': settings.MEDIA_ROOT}),
    # Web control panel SPA (client-side routing handled by React Router).
    re_path(r'^panel/.*$', panel_index, name='panel'),
    path('panel', panel_index),
]
