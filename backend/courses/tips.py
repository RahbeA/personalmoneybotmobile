"""Pick today's Home MoneyTip from admin-authored rows (DEV-660 / DEV-661)."""
from .models import MoneyTip, UserStats

GOAL_TO_CATEGORY = {
    'emergency_fund': 'saving',
    'pay_off_debt': 'credit',
    'start_investing': 'investing',
    'budget_better': 'budget',
    'boost_credit': 'credit',
    'save_big_goal': 'saving',
}


def preferred_categories(stats: UserStats) -> list[str]:
    cats = []
    for key in stats.onboarding_goals or []:
        cat = GOAL_TO_CATEGORY.get(key)
        if cat and cat not in cats:
            cats.append(cat)
    cats.append('general')
    return cats


def pick_money_tip(stats: UserStats) -> MoneyTip | None:
    active = list(MoneyTip.objects.filter(is_active=True))
    if not active:
        return None
    last_id = stats.last_money_tip_id
    for category in preferred_categories(stats):
        pool = [t for t in active if t.category == category]
        rotated = [t for t in pool if t.id != last_id] or pool
        if rotated:
            return rotated[0]
    rotated = [t for t in active if t.id != last_id] or active
    return rotated[0]


def serialize_tip(tip: MoneyTip | None) -> dict | None:
    if not tip:
        return None
    return {
        'id': tip.id,
        'body': tip.body,
        'category': tip.category,
    }
