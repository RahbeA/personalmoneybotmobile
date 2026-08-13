from django.urls import path
from . import views

urlpatterns = [
    path('login/', views.login, name='login'),
    path('register/', views.register, name='register'),
    path('guest/', views.guest_auth, name='guest_auth'),
    path('google/', views.google_auth, name='google_auth'),
    path('apple/', views.apple_auth, name='apple_auth'),
    path('logout/', views.logout, name='logout'),
    path('profile/', views.profile, name='profile'),
    path('account/', views.delete_account, name='delete_account'),
    path('invite/status/', views.invite_status, name='invite_status'),
    path('invite/validate/', views.invite_validate, name='invite_validate'),
    path('invites/', views.my_invites, name='my_invites'),
    path('invites/regenerate/', views.regenerate_invite, name='regenerate_invite'),
]
