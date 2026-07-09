from rest_framework import serializers
from .models import Module, Lesson, Question, Answer, UserProgress, UserStats, Badge
from .onboarding import compute_rank, total_questions


class AnswerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Answer
        fields = ['id', 'text', 'is_correct']


class QuestionSerializer(serializers.ModelSerializer):
    answers = AnswerSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ['id', 'question_type', 'prompt', 'explanation', 'order', 'answers']


class LessonSerializer(serializers.ModelSerializer):
    question_count = serializers.SerializerMethodField()
    is_completed = serializers.SerializerMethodField()

    class Meta:
        model = Lesson
        fields = ['id', 'title', 'order', 'question_count', 'is_completed']

    def get_question_count(self, obj):
        prefetched = getattr(obj, '_prefetched_objects_cache', {}).get('questions')
        if prefetched is not None:
            return len(prefetched)
        return obj.questions.count()

    def get_is_completed(self, obj):
        completed = self.context.get('completed_lesson_ids')
        if completed is not None:
            return obj.id in completed
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.user_progress.filter(user=request.user).exists()


class ModuleSerializer(serializers.ModelSerializer):
    lesson_count = serializers.SerializerMethodField()
    completed_lesson_count = serializers.SerializerMethodField()
    lessons = LessonSerializer(many=True, read_only=True)

    class Meta:
        model = Module
        fields = ['id', 'title', 'description', 'icon', 'order', 'lesson_count', 'completed_lesson_count', 'lessons']

    def get_lesson_count(self, obj):
        prefetched = getattr(obj, '_prefetched_objects_cache', {}).get('lessons')
        if prefetched is not None:
            return len(prefetched)
        return obj.lessons.count()

    def get_completed_lesson_count(self, obj):
        completed = self.context.get('completed_lesson_ids')
        if completed is not None:
            prefetched = getattr(obj, '_prefetched_objects_cache', {}).get('lessons')
            if prefetched is not None:
                return sum(1 for lesson in prefetched if lesson.id in completed)
            return UserProgress.objects.filter(
                user=self.context['request'].user,
                lesson__module=obj,
                lesson_id__in=completed,
            ).count()
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 0
        return UserProgress.objects.filter(
            user=request.user,
            lesson__module=obj,
        ).count()


class UserStatsSerializer(serializers.ModelSerializer):
    equipped_character = serializers.SerializerMethodField()
    rank = serializers.SerializerMethodField()
    onboarding_total = serializers.SerializerMethodField()

    class Meta:
        model = UserStats
        fields = [
            'xp', 'streak_days', 'last_active', 'badges', 'bot_bucks',
            'equipped_character', 'onboarding_completed', 'onboarding_score',
            'onboarding_total', 'onboarding_goals', 'rank', 'daily_reward_day',
            'daily_claim_streak', 'questions_correct', 'perfect_lessons',
        ]

    def get_equipped_character(self, obj):
        if not obj.equipped_character_id:
            return None
        from moneyverse.serializers import CharacterSerializer
        return CharacterSerializer(obj.equipped_character, context=self.context).data

    def get_rank(self, obj):
        return compute_rank(obj.onboarding_score, obj.xp)

    def get_onboarding_total(self, obj):
        return total_questions()


class LessonCompleteSerializer(serializers.Serializer):
    mistakes = serializers.IntegerField(min_value=0, default=0)
    # Device-local calendar date (YYYY-MM-DD) so streaks reset at the user's
    # local midnight instead of at midnight UTC. Optional for backward compat.
    client_date = serializers.DateField(required=False, allow_null=True)


class BadgeCatalogSerializer(serializers.ModelSerializer):
    icon_url = serializers.SerializerMethodField()
    module_id = serializers.IntegerField(source='module.id', read_only=True, allow_null=True)

    class Meta:
        model = Badge
        fields = [
            'key', 'name', 'description', 'metric', 'threshold',
            'module_id', 'icon_url', 'accent_color', 'ion_icon', 'order',
        ]

    def get_icon_url(self, obj):
        if not obj.icon:
            return None
        url = obj.icon.url
        try:
            mtime = int(obj.icon.storage.get_modified_time(obj.icon.name).timestamp())
            return f'{url}?v={mtime}'
        except (OSError, ValueError, NotImplementedError):
            return url
