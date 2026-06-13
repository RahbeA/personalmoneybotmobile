from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register('modules', views.ModuleViewSet, basename='admin-module')
router.register('lessons', views.LessonViewSet, basename='admin-lesson')
router.register('questions', views.QuestionViewSet, basename='admin-question')
router.register('answers', views.AnswerViewSet, basename='admin-answer')
router.register('characters', views.CharacterViewSet, basename='admin-character')
router.register('onboarding-questions', views.OnboardingQuestionViewSet, basename='admin-onboarding-question')
router.register('users', views.UserViewSet, basename='admin-user')
router.register('staff', views.StaffViewSet, basename='admin-staff')
router.register('ai/tutor-conversations', views.TutorConversationViewSet, basename='admin-tutor-conversation')
router.register('ai/money-chat-sessions', views.MoneyChatSessionViewSet, basename='admin-money-chat-session')

urlpatterns = [
    path('login/', views.admin_login, name='admin-login'),
    path('logout/', views.admin_logout, name='admin-logout'),
    path('me/', views.admin_me, name='admin-me'),
    path('stats/summary/', views.stats_summary, name='admin-stats-summary'),
    path('', include(router.urls)),
]
