from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from moneybot.cache_utils import (
    invalidate_badge_catalog_cache,
    invalidate_course_content,
    invalidate_leaderboard_snapshots,
    invalidate_lesson_questions,
)

from .models import Answer, Badge, DailyRewardTier, Lesson, Module, OnboardingQuestion, Question


@receiver(post_save, sender=Module)
@receiver(post_delete, sender=Module)
def bust_module_cache(sender, **kwargs):
    invalidate_course_content()


@receiver(post_save, sender=Lesson)
@receiver(post_delete, sender=Lesson)
def bust_lesson_cache(sender, instance, **kwargs):
    invalidate_course_content()
    invalidate_lesson_questions(instance.id)


@receiver(post_save, sender=Question)
@receiver(post_delete, sender=Question)
def bust_question_cache(sender, instance, **kwargs):
    invalidate_course_content()
    invalidate_lesson_questions(instance.lesson_id)


@receiver(post_save, sender=Answer)
@receiver(post_delete, sender=Answer)
def bust_answer_cache(sender, instance, **kwargs):
    invalidate_course_content()
    invalidate_lesson_questions(instance.question.lesson_id)


@receiver(post_save, sender=OnboardingQuestion)
@receiver(post_delete, sender=OnboardingQuestion)
def bust_onboarding_cache(sender, **kwargs):
    from django.core.cache import cache
    cache.delete('course:onboarding:questions:v1')
    invalidate_course_content()


@receiver(post_save, sender=Badge)
@receiver(post_delete, sender=Badge)
def bust_badge_cache(sender, **kwargs):
    invalidate_badge_catalog_cache()


@receiver(post_save, sender=DailyRewardTier)
@receiver(post_delete, sender=DailyRewardTier)
def bust_daily_reward_cache(sender, **kwargs):
    pass
