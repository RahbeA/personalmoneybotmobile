from django.db import models
from django.conf import settings


class UserAIProfile(models.Model):
    """Per-user evolving memory the AI uses to personalize tutoring."""
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='ai_profile'
    )
    learning_style = models.TextField(
        blank=True, help_text='Short description of how the user likes to learn'
    )
    memory = models.TextField(
        blank=True, help_text='Rolling summary of what the AI knows about the user'
    )
    preferences = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'AI profile for {self.user.email}'


class TutorConversation(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='tutor_conversations'
    )
    title = models.CharField(max_length=200, default='New chat')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f'{self.user.email}: {self.title}'


class TutorMessage(models.Model):
    ROLE_CHOICES = [('user', 'User'), ('assistant', 'Assistant')]

    conversation = models.ForeignKey(
        TutorConversation, on_delete=models.CASCADE, related_name='messages'
    )
    role = models.CharField(max_length=12, choices=ROLE_CHOICES)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at', 'id']

    def __str__(self):
        return f'{self.role}: {self.content[:50]}'


class MoneyChatSession(models.Model):
    STATUS_CHOICES = [
        ('in_progress', 'In progress'),
        ('passed', 'Passed'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='money_chat_sessions'
    )
    module = models.ForeignKey(
        'courses.Module', on_delete=models.CASCADE, related_name='money_chat_sessions'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='in_progress')
    passed = models.BooleanField(default=False)
    benchmarks = models.JSONField(default=list, blank=True)
    met_benchmark_ids = models.JSONField(default=list, blank=True)
    bonus_awarded = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user.email} money chat for {self.module.title} ({self.status})'


class MoneyChatMessage(models.Model):
    ROLE_CHOICES = [('user', 'User'), ('assistant', 'Assistant')]

    session = models.ForeignKey(
        MoneyChatSession, on_delete=models.CASCADE, related_name='messages'
    )
    role = models.CharField(max_length=12, choices=ROLE_CHOICES)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at', 'id']

    def __str__(self):
        return f'{self.role}: {self.content[:50]}'
