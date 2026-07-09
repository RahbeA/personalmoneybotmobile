"""Onboarding financial-literacy assessment + gamified ranking.

The question set is grounded in published financial-literacy research:

- Questions 1-3 are the "Big Three" by Annamaria Lusardi & Olivia S. Mitchell,
  the standard academic measure of financial literacy (interest/compounding,
  inflation, and risk diversification).
- Questions 4-5 extend to the "Big Five" used in the FINRA National Financial
  Capability Study (bond pricing and mortgage interest over time).

We keep the substance faithful to the research wording but present it in a
friendlier, conversational tone for an interactive onboarding flow. Correct
answers live here on the server so the client can't see/scrape them.
"""

# Seed/fallback data. The canonical source of truth is now the database
# (courses.OnboardingQuestion / OnboardingOption), editable from the control
# panel. This list seeds those tables on first migrate and acts as a safety
# fallback if the tables are ever empty. `correct` is NEVER serialized to clients.
SEED_QUESTIONS = [
    {
        'id': 'interest',
        'topic': 'Compound Interest',
        'emoji': '💸',
        'input_type': 'scale',
        'vibe': "Let's start with how money grows.",
        'prompt': (
            "You drop $100 into a savings account earning 2% a year and never "
            "touch it again. How much is in there after 5 years?"
        ),
        'options': [
            {'id': 'a', 'text': 'More than $102'},
            {'id': 'b', 'text': 'Exactly $102'},
            {'id': 'c', 'text': 'Less than $102'},
            {'id': 'd', 'text': "Not sure"},
        ],
        'correct': 'a',
    },
    {
        'id': 'inflation',
        'topic': 'Inflation',
        'emoji': '🎈',
        'input_type': 'scale',
        'vibe': 'Now the sneaky one that eats your money.',
        'prompt': (
            "Your account earns 1% a year, but prices (inflation) go up 2% a "
            "year. After 1 year, how much could you actually buy with that money?"
        ),
        'options': [
            {'id': 'a', 'text': 'More than today'},
            {'id': 'b', 'text': 'Exactly the same'},
            {'id': 'c', 'text': 'Less than today'},
            {'id': 'd', 'text': 'Not sure'},
        ],
        'correct': 'c',
    },
    {
        'id': 'diversification',
        'topic': 'Risk & Diversification',
        'emoji': '🧺',
        'input_type': 'truefalse',
        'vibe': "Don't put all your eggs in one basket.",
        'prompt': (
            "True or false: buying a single company's stock usually gives you a "
            "safer return than buying a whole stock mutual fund."
        ),
        'options': [
            {'id': 'a', 'text': 'True'},
            {'id': 'b', 'text': 'False'},
            {'id': 'c', 'text': 'Not sure'},
        ],
        'correct': 'b',
    },
    {
        'id': 'bonds',
        'topic': 'Bonds',
        'emoji': '📉',
        'input_type': 'choice',
        'vibe': 'A classic move-the-needle question.',
        'prompt': "When interest rates go up, what usually happens to bond prices?",
        'options': [
            {'id': 'a', 'text': 'They go up too'},
            {'id': 'b', 'text': 'They go down'},
            {'id': 'c', 'text': 'They stay the same'},
            {'id': 'd', 'text': 'Not sure'},
        ],
        'correct': 'b',
    },
    {
        'id': 'mortgage',
        'topic': 'Loans & Mortgages',
        'emoji': '🏠',
        'input_type': 'truefalse',
        'vibe': 'Last one — big-purchase smarts.',
        'prompt': (
            "True or false: a 15-year mortgage has higher monthly payments than "
            "a 30-year one, but you pay less total interest overall."
        ),
        'options': [
            {'id': 'a', 'text': 'True'},
            {'id': 'b', 'text': 'False'},
            {'id': 'c', 'text': 'Not sure'},
        ],
        'correct': 'a',
    },
]

# Points each correct onboarding answer contributes to the literacy score.
POINTS_PER_CORRECT = 100

# Gamified rank ladder. `min` is the literacy-point threshold to reach the tier.
# Literacy points = (onboarding correct * POINTS_PER_CORRECT) + lifetime XP, so
# ranks start from the baseline assessment and climb as users earn XP.
RANK_TIERS = [
    {'key': 'bronze', 'label': 'Money Rookie', 'tier': 1, 'min': 0},
    {'key': 'silver', 'label': 'Money Apprentice', 'tier': 2, 'min': 150},
    {'key': 'gold', 'label': 'Money Strategist', 'tier': 3, 'min': 400},
    {'key': 'platinum', 'label': 'Money Master', 'tier': 4, 'min': 750},
    {'key': 'diamond', 'label': 'Wealth Wizard', 'tier': 5, 'min': 1300},
]


def _questions_from_db():
    """Load questions from the DB in the same shape as SEED_QUESTIONS.

    Returns None if the tables are empty/unavailable so callers can fall back
    to SEED_QUESTIONS.
    """
    try:
        from .models import OnboardingQuestion
    except Exception:
        return None

    try:
        questions = list(
            OnboardingQuestion.objects.prefetch_related('options').all()
        )
    except Exception:
        # DB not migrated yet (e.g. during initial migrate).
        return None

    if not questions:
        return None

    shaped = []
    for q in questions:
        correct = next((o.key for o in q.options.all() if o.is_correct), None)
        shaped.append({
            'id': q.slug,
            'topic': q.topic,
            'emoji': q.emoji,
            'input_type': getattr(q, 'input_type', None) or 'choice',
            'vibe': q.vibe,
            'prompt': q.prompt,
            'options': [{'id': o.key, 'text': o.text} for o in q.options.all()],
            'correct': correct,
        })
    return shaped


def _all_questions():
    return _questions_from_db() or SEED_QUESTIONS


def total_questions():
    """Number of onboarding questions currently configured."""
    return len(_all_questions())


def public_questions():
    """Question payload safe for clients (correct answers stripped)."""
    return [
        {
            'id': q['id'],
            'topic': q['topic'],
            'emoji': q['emoji'],
            'input_type': q.get('input_type', 'choice'),
            'vibe': q['vibe'],
            'prompt': q['prompt'],
            'options': q['options'],
        }
        for q in _all_questions()
    ]


def score_answers(answers):
    """Score a {question_id: option_id} mapping.

    Returns (num_correct, results) where results is a per-question breakdown.
    """
    answers = answers or {}
    num_correct = 0
    results = []
    for q in _all_questions():
        chosen = answers.get(q['id'])
        is_correct = chosen == q['correct']
        if is_correct:
            num_correct += 1
        results.append({
            'id': q['id'],
            'topic': q['topic'],
            'your_option': chosen,
            'correct_option': q['correct'],
            'correct': is_correct,
        })
    return num_correct, results


def literacy_points(onboarding_score, xp):
    """Composite score combining the onboarding baseline with earned XP."""
    return (onboarding_score or 0) * POINTS_PER_CORRECT + (xp or 0)


def compute_rank(onboarding_score, xp):
    """Resolve the current gamified rank from baseline + XP."""
    points = literacy_points(onboarding_score, xp)

    current = RANK_TIERS[0]
    nxt = None
    for i, tier in enumerate(RANK_TIERS):
        if points >= tier['min']:
            current = tier
            nxt = RANK_TIERS[i + 1] if i + 1 < len(RANK_TIERS) else None

    if nxt:
        band = nxt['min'] - current['min']
        progress = (points - current['min']) / band if band else 1.0
        points_to_next = max(nxt['min'] - points, 0)
    else:
        progress = 1.0
        points_to_next = 0

    return {
        'key': current['key'],
        'label': current['label'],
        'tier': current['tier'],
        'max_tier': len(RANK_TIERS),
        'points': points,
        'tier_min': current['min'],
        'next_label': nxt['label'] if nxt else None,
        'next_min': nxt['min'] if nxt else None,
        'points_to_next': points_to_next,
        'progress': round(min(max(progress, 0.0), 1.0), 4),
    }
