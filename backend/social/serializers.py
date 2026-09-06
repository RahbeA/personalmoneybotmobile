from rest_framework import serializers

from moneybot.media_urls import absolute_media_url
from .models import FeedPost
from .service import serialize_user_brief


class FeedPostSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    author = serializers.SerializerMethodField()
    upvote_count = serializers.SerializerMethodField()
    bookmark_count = serializers.SerializerMethodField()
    has_upvoted = serializers.SerializerMethodField()
    has_bookmarked = serializers.SerializerMethodField()

    class Meta:
        model = FeedPost
        fields = (
            'id', 'author', 'image_url', 'caption', 'link',
            'status', 'visibility', 'created_at',
            'upvote_count', 'bookmark_count', 'has_upvoted', 'has_bookmarked',
        )
        read_only_fields = fields

    def get_image_url(self, obj):
        return absolute_media_url(obj.image, self.context.get('request'))

    def get_author(self, obj):
        return serialize_user_brief(obj.author, self.context.get('request'))

    def get_upvote_count(self, obj):
        if hasattr(obj, 'upvote_count'):
            return obj.upvote_count
        return obj.upvotes.count()

    def get_bookmark_count(self, obj):
        if hasattr(obj, 'bookmark_count'):
            return obj.bookmark_count
        return obj.bookmarks.count()

    def get_has_upvoted(self, obj):
        if hasattr(obj, 'has_upvoted'):
            return bool(obj.has_upvoted)
        return False

    def get_has_bookmarked(self, obj):
        if hasattr(obj, 'has_bookmarked'):
            return bool(obj.has_bookmarked)
        return False
