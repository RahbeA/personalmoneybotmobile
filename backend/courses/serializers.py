from rest_framework import serializers
from .models import Module, Lesson, Question, Answer, UserProgress, UserStats
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
        return obj.questions.count()

    def get_is_completed(self, obj):
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
        return obj.lessons.count()

    def get_completed_lesson_count(self, obj):
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
            'onboarding_total', 'rank',
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
