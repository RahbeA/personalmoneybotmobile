from django.conf import settings
from rest_framework import serializers
from moneybot.media_urls import absolute_media_url
from .models import Character


class CharacterSerializer(serializers.ModelSerializer):
    model_url = serializers.SerializerMethodField()
    preview_url = serializers.SerializerMethodField()
    is_owned = serializers.SerializerMethodField()

    class Meta:
        model = Character
        fields = [
            'id', 'name', 'description', 'price', 'rarity', 'accent_color',
            'order', 'model_url', 'preview_url', 'is_owned', 'is_premium',
        ]

    def _absolute(self, file_field):
        return absolute_media_url(file_field, self.context.get('request'))

    def get_model_url(self, obj):
        return self._absolute(obj.model_file)

    def get_preview_url(self, obj):
        return self._absolute(obj.preview_image)

    def get_is_owned(self, obj):
        owned_ids = self.context.get('owned_ids')
        if owned_ids is not None:
            return obj.id in owned_ids
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.owners.filter(user=request.user).exists()
