from django.urls import path

from . import views

urlpatterns = [
    path('', views.daily_today, name='daily-today'),
    path('submit/', views.daily_submit, name='daily-submit'),
    path('leaderboard/', views.daily_leaderboard, name='daily-leaderboard'),
]
