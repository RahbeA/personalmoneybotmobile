from django.urls import path
from . import views

urlpatterns = [
    path('login/', views.login, name='login'),
    path('register/', views.register, name='register'),
    path('google/', views.google_auth, name='google_auth'),
    path('apple/', views.apple_auth, name='apple_auth'),
    path('logout/', views.logout, name='logout'),
    path('profile/', views.profile, name='profile'),
    path('account/', views.delete_account, name='delete_account'),
]
