from django.urls import path
from . import views

urlpatterns = [
    path('tutor/conversations/', views.conversations, name='tutor-conversations'),
    path('tutor/conversations/<int:conversation_id>/messages/', views.conversation_messages, name='tutor-conversation-messages'),
    path('tutor/chat/', views.tutor_chat, name='tutor-chat'),
    path('money-chat/start/', views.money_chat_start, name='money-chat-start'),
    path('money-chat/message/', views.money_chat_message, name='money-chat-message'),
]
