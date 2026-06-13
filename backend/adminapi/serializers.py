from django.contrib.auth import get_user_model
from rest_framework import serializers

from courses.models import (
    Module, Lesson, Question, Answer, UserProgress, UserStats,
    OnboardingQuestion, OnboardingOption,
)
from moneyverse.models import Character
from ai.models import (
    TutorConversation,
    TutorMessage,
    MoneyChatSession,
    MoneyChatMessage,
)

User = get_user_model()


# --- Courses: content management -------------------------------------------

class AnswerSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)

    class Meta:
        model = Answer
        fields = ('id', 'text', 'is_correct')


class QuestionSerializer(serializers.ModelSerializer):
    answers = AnswerSerializer(many=True, required=False)

    class Meta:
        model = Question
        fields = ('id', 'lesson', 'question_type', 'prompt', 'explanation', 'order', 'answers')

    def create(self, validated_data):
        answers = validated_data.pop('answers', [])
        question = Question.objects.create(**validated_data)
        for answer in answers:
            answer.pop('id', None)
            Answer.objects.create(question=question, **answer)
        return question

    def update(self, instance, validated_data):
        answers = validated_data.pop('answers', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if answers is not None:
            # Replace the answer set wholesale; simplest and safest for an editor.
            instance.answers.all().delete()
            for answer in answers:
                answer.pop('id', None)
                Answer.objects.create(question=instance, **answer)
        return instance


class LessonSerializer(serializers.ModelSerializer):
    question_count = serializers.IntegerField(source='questions.count', read_only=True)

    class Meta:
        model = Lesson
        fields = ('id', 'module', 'title', 'order', 'question_count')


class ModuleSerializer(serializers.ModelSerializer):
    lesson_count = serializers.IntegerField(source='lessons.count', read_only=True)

    class Meta:
        model = Module
        fields = ('id', 'title', 'description', 'icon', 'order', 'money_chat_criteria', 'lesson_count')


# --- Onboarding questions ---------------------------------------------------

class OnboardingOptionSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)

    class Meta:
        model = OnboardingOption
        fields = ('id', 'key', 'text', 'is_correct', 'order')


class OnboardingQuestionSerializer(serializers.ModelSerializer):
    options = OnboardingOptionSerializer(many=True, required=False)

    class Meta:
        model = OnboardingQuestion
        fields = ('id', 'slug', 'topic', 'emoji', 'vibe', 'prompt', 'order', 'options')

    def create(self, validated_data):
        options = validated_data.pop('options', [])
        question = OnboardingQuestion.objects.create(**validated_data)
        for opt in options:
            opt.pop('id', None)
            OnboardingOption.objects.create(question=question, **opt)
        return question

    def update(self, instance, validated_data):
        options = validated_data.pop('options', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if options is not None:
            instance.options.all().delete()
            for opt in options:
                opt.pop('id', None)
                OnboardingOption.objects.create(question=instance, **opt)
        return instance


# --- Moneyverse: characters -------------------------------------------------

class CharacterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Character
        fields = (
            'id', 'name', 'description', 'price', 'rarity', 'accent_color',
            'model_file', 'preview_image', 'order', 'is_active',
        )


# --- Users ------------------------------------------------------------------

class UserStatsSerializer(serializers.ModelSerializer):
    lessons_completed = serializers.SerializerMethodField()

    class Meta:
        model = UserStats
        fields = (
            'xp', 'streak_days', 'last_active', 'badges', 'bot_bucks',
            'onboarding_completed', 'onboarding_score', 'lessons_completed',
        )

    def get_lessons_completed(self, obj):
        return UserProgress.objects.filter(user=obj.user).count()


class AdminUserSerializer(serializers.ModelSerializer):
    stats = serializers.SerializerMethodField()
    auth_provider = serializers.SerializerMethodField()
    lessons_completed = serializers.IntegerField(source='_lessons_completed', read_only=True, default=0)

    class Meta:
        model = User
        fields = (
            'id', 'email', 'name', 'avatar_url', 'is_active', 'is_staff',
            'is_superuser', 'date_joined', 'auth_provider', 'stats', 'lessons_completed',
        )
        read_only_fields = ('id', 'email', 'date_joined', 'is_superuser', 'is_staff')

    def get_stats(self, obj):
        stats = getattr(obj, 'stats', None)
        if stats is None:
            return None
        data = UserStatsSerializer(stats).data
        # Prefer queryset annotation over per-row count query when available.
        if hasattr(obj, '_lessons_completed'):
            data['lessons_completed'] = obj._lessons_completed
        return data

    def get_auth_provider(self, obj):
        if obj.google_id:
            return 'google'
        if obj.apple_id:
            return 'apple'
        return 'email'


class AdminStaffSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'email', 'name', 'is_staff', 'is_superuser', 'is_active', 'date_joined')
        read_only_fields = ('id', 'email', 'date_joined', 'is_superuser', 'is_staff')


class StaffCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True, required=False, allow_blank=True)
    name = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_email(self, value):
        return value.strip().lower()


# --- AI inspector (read-only) ----------------------------------------------

class TutorMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = TutorMessage
        fields = ('id', 'role', 'content', 'created_at')


class TutorConversationSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    message_count = serializers.IntegerField(source='messages.count', read_only=True)

    class Meta:
        model = TutorConversation
        fields = ('id', 'user_email', 'title', 'message_count', 'created_at', 'updated_at')


class TutorConversationDetailSerializer(TutorConversationSerializer):
    messages = TutorMessageSerializer(many=True, read_only=True)

    class Meta(TutorConversationSerializer.Meta):
        fields = TutorConversationSerializer.Meta.fields + ('messages',)


class MoneyChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = MoneyChatMessage
        fields = ('id', 'role', 'content', 'created_at')


class MoneyChatSessionSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    module_title = serializers.CharField(source='module.title', read_only=True)
    message_count = serializers.IntegerField(source='messages.count', read_only=True)

    class Meta:
        model = MoneyChatSession
        fields = (
            'id', 'user_email', 'module_title', 'status', 'passed',
            'bonus_awarded', 'message_count', 'created_at', 'updated_at',
        )


class MoneyChatSessionDetailSerializer(MoneyChatSessionSerializer):
    messages = MoneyChatMessageSerializer(many=True, read_only=True)
    benchmarks = serializers.JSONField(read_only=True)
    met_benchmark_ids = serializers.JSONField(read_only=True)

    class Meta(MoneyChatSessionSerializer.Meta):
        fields = MoneyChatSessionSerializer.Meta.fields + ('benchmarks', 'met_benchmark_ids', 'messages')
