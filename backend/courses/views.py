from datetime import date, timedelta
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Module, Lesson, Question, UserProgress, UserStats
from .serializers import (
    ModuleSerializer, LessonSerializer, QuestionSerializer,
    UserStatsSerializer, LessonCompleteSerializer,
)
from . import onboarding

XP_PER_LESSON = 50
XP_BONUS_PERFECT = 10  # bonus for 0 mistakes
BOT_BUCKS_PER_LESSON = 10
BOT_BUCKS_PERFECT_BONUS = 5  # bonus Bot Bucks for 0 mistakes


def get_or_create_stats(user):
    stats, _ = UserStats.objects.get_or_create(user=user)
    return stats


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def module_list(request):
    modules = Module.objects.all()
    serializer = ModuleSerializer(modules, many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def module_lessons(request, module_id):
    try:
        module = Module.objects.get(id=module_id)
    except Module.DoesNotExist:
        return Response({'detail': 'Module not found.'}, status=status.HTTP_404_NOT_FOUND)
    serializer = LessonSerializer(module.lessons.all(), many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def lesson_questions(request, lesson_id):
    try:
        lesson = Lesson.objects.get(id=lesson_id)
    except Lesson.DoesNotExist:
        return Response({'detail': 'Lesson not found.'}, status=status.HTTP_404_NOT_FOUND)
    serializer = QuestionSerializer(lesson.questions.all(), many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def complete_lesson(request, lesson_id):
    try:
        lesson = Lesson.objects.get(id=lesson_id)
    except Lesson.DoesNotExist:
        return Response({'detail': 'Lesson not found.'}, status=status.HTTP_404_NOT_FOUND)

    serializer = LessonCompleteSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    mistakes = serializer.validated_data['mistakes']

    already_completed = UserProgress.objects.filter(user=request.user, lesson=lesson).exists()

    xp_earned = 0
    stars = 3
    new_badge = None
    bot_bucks_earned = 0

    if not already_completed:
        if mistakes == 0:
            xp_earned = XP_PER_LESSON + XP_BONUS_PERFECT
        elif mistakes == 1:
            stars = 2
            xp_earned = XP_PER_LESSON
        else:
            stars = 1
            xp_earned = max(XP_PER_LESSON - (mistakes * 5), 10)

        bot_bucks_earned = BOT_BUCKS_PER_LESSON + (BOT_BUCKS_PERFECT_BONUS if mistakes == 0 else 0)

        UserProgress.objects.create(
            user=request.user,
            lesson=lesson,
            xp_earned=xp_earned,
            stars=stars,
        )

        stats = get_or_create_stats(request.user)
        stats.xp += xp_earned
        stats.bot_bucks += bot_bucks_earned

        today = date.today()
        if stats.last_active == today - timedelta(days=1):
            stats.streak_days += 1
        elif stats.last_active != today:
            stats.streak_days = 1
        stats.last_active = today

        # Award badges
        badges = list(stats.badges)
        completed_lessons = UserProgress.objects.filter(user=request.user).count()

        if 'first_lesson' not in badges and completed_lessons >= 1:
            badges.append('first_lesson')
            new_badge = 'first_lesson'

        if stats.streak_days >= 7 and 'streak_7' not in badges:
            badges.append('streak_7')
            new_badge = new_badge or 'streak_7'

        if stats.streak_days >= 30 and 'streak_30' not in badges:
            badges.append('streak_30')
            new_badge = new_badge or 'streak_30'

        module_badge_map = {1: 'module_1', 2: 'module_2', 3: 'module_3', 4: 'module_4', 5: 'module_5'}
        module = lesson.module
        module_lessons_total = module.lessons.count()
        module_lessons_done = UserProgress.objects.filter(
            user=request.user, lesson__module=module
        ).count()
        badge_key = module_badge_map.get(module.order)
        if badge_key and module_lessons_done >= module_lessons_total and badge_key not in badges:
            badges.append(badge_key)
            new_badge = new_badge or badge_key

        all_modules = Module.objects.count()
        all_lessons_total = Lesson.objects.count()
        if completed_lessons >= all_lessons_total and 'all_courses' not in badges:
            badges.append('all_courses')
            new_badge = new_badge or 'all_courses'

        stats.badges = badges
        stats.save()

    updated_stats = get_or_create_stats(request.user)
    module_complete = False
    if not already_completed:
        module = lesson.module
        module_lessons_total = module.lessons.count()
        module_lessons_done = UserProgress.objects.filter(
            user=request.user, lesson__module=module
        ).count()
        module_complete = module_lessons_done >= module_lessons_total

    return Response({
        'already_completed': already_completed,
        'xp_earned': xp_earned,
        'bot_bucks_earned': bot_bucks_earned,
        'stars': stars,
        'new_badge': new_badge,
        'module_complete': module_complete,
        'module_title': lesson.module.title,
        'module_icon': lesson.module.icon,
        'stats': UserStatsSerializer(updated_stats, context={'request': request}).data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_stats(request):
    stats = get_or_create_stats(request.user)
    completed_lesson_ids = list(
        UserProgress.objects.filter(user=request.user).values_list('lesson_id', flat=True)
    )
    return Response({
        **UserStatsSerializer(stats, context={'request': request}).data,
        'completed_lesson_ids': completed_lesson_ids,
        'lessons_completed': len(completed_lesson_ids),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def onboarding_questions(request):
    """Return the financial-literacy onboarding questions (no answer keys)."""
    return Response({
        'questions': onboarding.public_questions(),
        'total': onboarding.total_questions(),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def onboarding_submit(request):
    """Score the onboarding assessment, persist the baseline, and return rank."""
    answers = request.data.get('answers') or {}
    if not isinstance(answers, dict):
        return Response(
            {'detail': 'answers must be an object of {question_id: option_id}.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    num_correct, results = onboarding.score_answers(answers)

    stats = get_or_create_stats(request.user)
    stats.onboarding_completed = True
    stats.onboarding_score = num_correct
    stats.onboarding_answers = answers
    stats.save(update_fields=['onboarding_completed', 'onboarding_score', 'onboarding_answers'])

    rank = onboarding.compute_rank(num_correct, stats.xp)

    return Response({
        'score': num_correct,
        'total': onboarding.total_questions(),
        'results': results,
        'rank': rank,
        'stats': UserStatsSerializer(stats, context={'request': request}).data,
    })
