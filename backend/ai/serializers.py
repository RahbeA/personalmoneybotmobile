from rest_framework import serializers
from .models import TutorConversation, TutorMessage, MoneyChatMessage


class TutorMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = TutorMessage
        fields = ['id', 'role', 'content', 'created_at']


class TutorConversationSerializer(serializers.ModelSerializer):
    last_message = serializers.SerializerMethodField()

    class Meta:
        model = TutorConversation
        fields = ['id', 'title', 'created_at', 'updated_at', 'last_message']

    def get_last_message(self, obj):
        msg = obj.messages.last()
        return msg.content[:120] if msg else ''


class MoneyChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = MoneyChatMessage
        fields = ['id', 'role', 'content', 'created_at']
