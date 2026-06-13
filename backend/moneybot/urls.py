from django.contrib import admin
from django.urls import path, re_path, include
from django.conf import settings
from django.conf.urls.static import static

from .views import panel_index

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/courses/', include('courses.urls')),
    path('api/moneyverse/', include('moneyverse.urls')),
    path('api/ai/', include('ai.urls')),
    path('api/admin/', include('adminapi.urls')),
    # Web control panel SPA (client-side routing handled by React Router).
    re_path(r'^panel/.*$', panel_index, name='panel'),
    path('panel', panel_index),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
