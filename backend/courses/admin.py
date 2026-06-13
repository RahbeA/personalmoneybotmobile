from django.contrib import admin
from .models import Module, Lesson, Question, Answer, UserProgress, UserStats


class AnswerInline(admin.TabularInline):
    model = Answer
    extra = 2


class QuestionInline(admin.StackedInline):
    model = Question
    extra = 0
    inlines = [AnswerInline]


class LessonInline(admin.TabularInline):
    model = Lesson
    extra = 0


@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):
    list_display = ('order', 'icon', 'title')
    ordering = ('order',)
    fields = ('order', 'icon', 'title', 'description', 'money_chat_criteria')
    inlines = [LessonInline]


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ('module', 'order', 'title')
    list_filter = ('module',)
    ordering = ('module__order', 'order')
    inlines = [QuestionInline]


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ('lesson', 'order', 'question_type', 'prompt')
    list_filter = ('lesson__module', 'question_type')
    inlines = [AnswerInline]


@admin.register(UserProgress)
class UserProgressAdmin(admin.ModelAdmin):
    list_display = ('user', 'lesson', 'xp_earned', 'stars', 'completed_at')
    list_filter = ('lesson__module',)


@admin.register(UserStats)
class UserStatsAdmin(admin.ModelAdmin):
    list_display = ('user', 'xp', 'streak_days', 'last_active')
