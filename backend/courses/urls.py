from django.urls import path
from . import views

urlpatterns = [
    path('modules/', views.module_list, name='module-list'),
    path('modules/<int:module_id>/lessons/', views.module_lessons, name='module-lessons'),
    path('lessons/<int:lesson_id>/questions/', views.lesson_questions, name='lesson-questions'),
    path('lessons/<int:lesson_id>/complete/', views.complete_lesson, name='complete-lesson'),
    path('stats/', views.user_stats, name='user-stats'),
    path('daily-reward/claim/', views.claim_daily_reward, name='claim-daily-reward'),
    path('leaderboard/', views.leaderboard, name='leaderboard'),
    path('onboarding/questions/', views.onboarding_questions, name='onboarding-questions'),
    path('onboarding/submit/', views.onboarding_submit, name='onboarding-submit'),
    path('goals/', views.update_goals, name='update-goals'),
    path('streak-goal/', views.update_streak_goal, name='update-streak-goal'),
    path('personality/', views.update_personality, name='update-personality'),
    path('money-tip/', views.todays_money_tip, name='money-tip'),
]
