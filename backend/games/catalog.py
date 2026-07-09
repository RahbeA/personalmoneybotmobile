"""Arcade game catalog and economy constants."""

PLAY_COST = 10

# Bonus Bot Bucks for beating your previous personal best (rewards improvement).
NEW_BEST_BONUS = 10

# XP awarded when score meets or exceeds threshold (highest matching tier wins).
XP_THRESHOLDS = {
    'budget_blitz': [
        (500, 75),
        (300, 50),
        (150, 30),
        (50, 15),
    ],
    'inflation_dodge': [
        (400, 60),
        (250, 40),
        (100, 20),
    ],
    'credit_climb': [
        (400, 60),
        (250, 40),
        (100, 20),
    ],
    'scam_spotter': [
        (400, 60),
        (250, 40),
        (100, 20),
    ],
}

# Bot Bucks awarded by score tier — the tangible payout for playing well. Play
# costs PLAY_COST, so a strong run nets positive currency to spend on characters
# and more plays, while a weak run doesn't (incentive to improve).
BOT_BUCK_THRESHOLDS = {
    'budget_blitz': [
        (500, 30),
        (300, 18),
        (150, 10),
        (50, 4),
    ],
    'inflation_dodge': [
        (400, 28),
        (250, 16),
        (100, 6),
    ],
    'credit_climb': [
        (400, 28),
        (250, 16),
        (100, 6),
    ],
    'scam_spotter': [
        (400, 28),
        (250, 16),
        (100, 6),
    ],
}

GAMES = [
    {
        'key': 'budget_blitz',
        'title': 'Budget Blitz',
        'description': 'Sort expenses into Needs, Wants, and Savings before time runs out.',
        'icon': 'wallet',
        'playable': True,
        'duration_seconds': 60,
    },
    {
        'key': 'inflation_dodge',
        'title': 'Inflation Dodge',
        'description': 'Grab real value before inflation shrinks your coins.',
        'icon': 'trending-down',
        'playable': True,
        'duration_seconds': 60,
    },
    {
        'key': 'credit_climb',
        'title': 'Credit Climb',
        'description': 'Keep credit utilization under 30% while charges hit.',
        'icon': 'card',
        'playable': True,
        'duration_seconds': 60,
    },
    {
        'key': 'scam_spotter',
        'title': 'Scam Spotter',
        'description': 'Spot phishing texts and emails before they trick you.',
        'icon': 'shield-checkmark',
        'playable': True,
        'duration_seconds': 60,
    },
]


def get_game(key):
    for game in GAMES:
        if game['key'] == key:
            return game
    return None


def xp_for_score(game_key, score):
    tiers = XP_THRESHOLDS.get(game_key, [])
    xp = 0
    for threshold, reward in tiers:
        if score >= threshold:
            xp = reward
            break
    return xp


def bot_bucks_for_score(game_key, score):
    tiers = BOT_BUCK_THRESHOLDS.get(game_key, [])
    bucks = 0
    for threshold, reward in tiers:
        if score >= threshold:
            bucks = reward
            break
    return bucks
