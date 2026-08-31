from django.db import models
from django.conf import settings


class Module(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField()
    icon = models.CharField(max_length=10)  # emoji
    order = models.PositiveIntegerField(default=0)
    money_chat_criteria = models.TextField(
        blank=True,
        help_text=(
            'Optional custom Money Chat checkpoints for this module. If set, these '
            'are merged with the AI-generated benchmarks. One criterion per line.'
        ),
    )

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.title


class Lesson(models.Model):
    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name='lessons')
    title = models.CharField(max_length=200)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.module.title} — {self.title}"


class Question(models.Model):
    TYPE_CHOICES = [
        ('true_false', 'True / False'),
        ('mcq', 'Multiple Choice'),
        ('select_all', 'Select All That Apply'),
        ('match', 'Match the Following'),
        ('fill_blank', 'Fill in the Blanks'),
    ]

    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='questions')
    question_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    prompt = models.TextField()
    explanation = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.lesson.title} Q{self.order}: {self.prompt[:60]}"


class Answer(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='answers')
    text = models.CharField(max_length=500)
    is_correct = models.BooleanField(default=False)

    def __str__(self):
        return f"{'✓' if self.is_correct else '✗'} {self.text[:60]}"


class OnboardingQuestion(models.Model):
    """Editable financial-literacy onboarding question (was hardcoded)."""

    INPUT_CHOICE = 'choice'
    INPUT_TRUE_FALSE = 'truefalse'
    INPUT_SCALE = 'scale'
    INPUT_TYPE_CHOICES = [
        (INPUT_CHOICE, 'Multiple choice cards'),
        (INPUT_TRUE_FALSE, 'True / False buttons'),
        (INPUT_SCALE, 'Slider scale'),
    ]

    slug = models.SlugField(
        max_length=50, unique=True,
        help_text='Stable identifier sent to/from clients (e.g. "interest").',
    )
    topic = models.CharField(max_length=100)
    emoji = models.CharField(max_length=10, blank=True)
    vibe = models.CharField(max_length=255, blank=True, help_text='Short friendly framing line.')
    prompt = models.TextField()
    input_type = models.CharField(
        max_length=20, choices=INPUT_TYPE_CHOICES, default=INPUT_CHOICE,
        help_text='How the client renders the answer picker for this question.',
    )
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return f'{self.topic}: {self.prompt[:50]}'


class OnboardingOption(models.Model):
    question = models.ForeignKey(
        OnboardingQuestion, on_delete=models.CASCADE, related_name='options'
    )
    key = models.CharField(max_length=10, help_text='Option id sent to clients (e.g. "a").')
    text = models.CharField(max_length=255)
    is_correct = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return f"{'✓' if self.is_correct else '✗'} {self.text[:50]}"


class UserProgress(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='lesson_progress')
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='user_progress')
    completed_at = models.DateTimeField(auto_now_add=True)
    xp_earned = models.PositiveIntegerField(default=50)
    stars = models.PositiveIntegerField(default=3)  # 1-3

    class Meta:
        unique_together = ('user', 'lesson')

    def __str__(self):
        return f"{self.user.email} completed {self.lesson.title}"


class UserStats(models.Model):
    BADGE_CHOICES = [
        ('first_lesson', 'First Step'),
        ('module_1', 'Budget Master'),
        ('module_2', 'Savings Pro'),
        ('module_3', 'Credit Wise'),
        ('module_4', 'Tax Savvy'),
        ('module_5', 'Insurance Expert'),
        ('streak_7', '7-Day Streak'),
        ('streak_30', '30-Day Streak'),
        ('all_courses', 'Graduate'),
    ]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='stats')
    xp = models.PositiveIntegerField(default=0)
    streak_days = models.PositiveIntegerField(default=0)
    last_active = models.DateField(null=True, blank=True)
    badges = models.JSONField(default=list)
    bot_bucks = models.PositiveIntegerField(default=0)
    equipped_character = models.ForeignKey(
        'moneyverse.Character',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='+',
    )
    # Onboarding financial-literacy assessment (the Big Five questions).
    onboarding_completed = models.BooleanField(default=False)
    onboarding_score = models.PositiveIntegerField(
        default=0, help_text='Number of onboarding questions answered correctly.'
    )
    onboarding_answers = models.JSONField(
        default=dict, blank=True, help_text='Raw {question_id: option_id} answers.'
    )
    onboarding_goals = models.JSONField(
        default=list, blank=True, help_text='Goal keys the user selected during onboarding.'
    )
    # Daily login reward ladder (day 1–7 → Bot Bucks tiers).
    daily_reward_day = models.PositiveIntegerField(
        default=1, help_text='Next reward tier (1–7) on claim.',
    )
    last_daily_claim = models.DateField(null=True, blank=True)
    daily_claim_streak = models.PositiveIntegerField(
        default=0, help_text='Consecutive days the daily reward was claimed.',
    )
    streak_goal = models.PositiveIntegerField(
        default=7,
        help_text='Personal streak commitment in days (e.g. 7, 14, 30, 60).',
    )
    questions_correct = models.PositiveIntegerField(default=0)
    questions_answered = models.PositiveIntegerField(default=0)
    perfect_lessons = models.PositiveIntegerField(default=0)
    is_premium = models.BooleanField(
        default=False,
        help_text='RevenueCat / admin-granted premium entitlement (DEV-576 / DEV-594).',
    )
    CHAT_CHILL = 'chill'
    CHAT_COACH = 'coach'
    CHAT_FUNNY = 'funny'
    CHAT_TEACHER = 'teacher'
    CHAT_PERSONALITY_CHOICES = [
        (CHAT_CHILL, 'Chill friend'),
        (CHAT_COACH, 'Coach'),
        (CHAT_FUNNY, 'Funny'),
        (CHAT_TEACHER, 'Straight-up teacher'),
    ]
    chat_personality = models.CharField(
        max_length=16,
        choices=CHAT_PERSONALITY_CHOICES,
        default=CHAT_CHILL,
        help_text='Tutor / Money Chat voice preset (DEV-656).',
    )
    last_money_tip = models.ForeignKey(
        'MoneyTip',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+',
        help_text='Last Home tip shown, so daily rotation does not repeat (DEV-661).',
    )

    def __str__(self):
        return f"{self.user.email} — {self.xp} XP, {self.streak_days} day streak"


class MoneyTip(models.Model):
    """Admin-authored Home 'Today's Tip' lines (DEV-660 / DEV-661)."""

    CATEGORY_CHOICES = [
        ('general', 'General'),
        ('budget', 'Budget'),
        ('investing', 'Investing'),
        ('credit', 'Credit'),
        ('saving', 'Saving'),
        ('stocks', 'Stocks'),
    ]

    body = models.CharField(max_length=280)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='general')
    is_active = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return f'[{self.category}] {self.body[:48]}'


class Badge(models.Model):
    """Admin-configurable achievement badge."""

    METRIC_CHOICES = [
        ('lessons_completed', 'Lessons completed'),
        ('modules_completed', 'Modules completed (all lessons in module)'),
        ('module_completed', 'Specific module completed'),
        ('streak_days', 'Lesson activity streak (days)'),
        ('daily_claim_streak', 'Daily reward claim streak (days)'),
        ('daily_reward_day', 'Daily reward tier reached (1–7)'),
        ('bot_bucks', 'Bot Bucks balance'),
        ('xp', 'Total XP'),
        ('onboarding_score', 'Onboarding score'),
        ('characters_owned', 'Characters owned'),
        ('friends_count', 'Accepted friends'),
        ('questions_correct', 'Questions answered correctly'),
        ('perfect_lessons', 'Perfect lessons (0 mistakes)'),
    ]

    key = models.SlugField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    metric = models.CharField(max_length=30, choices=METRIC_CHOICES)
    threshold = models.PositiveIntegerField(default=1)
    module = models.ForeignKey(
        Module, null=True, blank=True, on_delete=models.CASCADE,
        help_text='Required for module_completed metric.',
    )
    icon = models.ImageField(upload_to='badges/', blank=True, null=True)
    accent_color = models.CharField(max_length=7, default='#3DDC5F')
    ion_icon = models.CharField(
        max_length=40, default='ribbon',
        help_text='Ionicons fallback when no icon image is uploaded.',
    )
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return self.name


class DailyRewardTier(models.Model):
    """Bot Bucks granted on each consecutive daily claim (days 1–7)."""

    day = models.PositiveIntegerField(unique=True)
    bot_bucks = models.PositiveIntegerField()

    class Meta:
        ordering = ['day']

    def __str__(self):
        return f'Day {self.day}: {self.bot_bucks} Bot Bucks'
