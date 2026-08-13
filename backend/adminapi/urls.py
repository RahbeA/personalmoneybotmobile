from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register('modules', views.ModuleViewSet, basename='admin-module')
router.register('lessons', views.LessonViewSet, basename='admin-lesson')
router.register('questions', views.QuestionViewSet, basename='admin-question')
router.register('answers', views.AnswerViewSet, basename='admin-answer')
router.register('characters', views.CharacterViewSet, basename='admin-character')
router.register('badges', views.BadgeViewSet, basename='admin-badge')
router.register('daily-rewards', views.DailyRewardTierViewSet, basename='admin-daily-reward')
router.register('onboarding-questions', views.OnboardingQuestionViewSet, basename='admin-onboarding-question')
router.register('users', views.UserViewSet, basename='admin-user')
router.register('notifications', views.NotificationCampaignViewSet, basename='admin-notification')
router.register('staff', views.StaffViewSet, basename='admin-staff')
router.register('ai/tutor-conversations', views.TutorConversationViewSet, basename='admin-tutor-conversation')
router.register('ai/money-chat-sessions', views.MoneyChatSessionViewSet, basename='admin-money-chat-session')

urlpatterns = [
    path('login/', views.admin_login, name='admin-login'),
    path('logout/', views.admin_logout, name='admin-logout'),
    path('me/', views.admin_me, name='admin-me'),
    path('change-password/', views.change_password, name='admin-change-password'),
    path('stats/summary/', views.stats_summary, name='admin-stats-summary'),
    path('cache/health/', views.cache_health, name='admin-cache-health'),
    path('glb/optimize/', views.optimize_glb_upload, name='admin-glb-optimize'),
    path('invite-config/', views.invite_config, name='admin-invite-config'),
    path('invites/bulk/', views.invites_bulk_create, name='admin-invites-bulk'),
    path('invites/', views.invites_list, name='admin-invites-list'),
    path('', include(router.urls)),
]
