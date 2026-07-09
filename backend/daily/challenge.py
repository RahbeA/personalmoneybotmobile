"""Deterministic daily-puzzle generation and server-side scoring.

The puzzle for a given calendar date is generated from a seed derived from that
date, so every user in the world gets the identical set of rounds (Wordle-style)
without us having to pre-author a puzzle per day. Answers are computed and stored
server-side; the sanitized payload sent to the client never contains them.
"""
import random
from datetime import date

from .content import POOLS as STATIC_POOLS, ROUND_PATTERN, MAX_ROUND_POINTS

# Puzzle #1 is Jan 1 2025. Keeps the shareable "MoneyBot Daily #123" small.
EPOCH = date(2025, 1, 1)

COLOR_EMOJI = {'green': '🟩', 'yellow': '🟨', 'black': '⬛'}


def challenge_number(day):
    return (day - EPOCH).days + 1


def _seeded_rng(day):
    # Offset keeps the seed from coinciding with other date-seeded features.
    return random.Random(day.toordinal() * 2654435761 % (2 ** 32))


def active_pools():
    """Return the content pools, preferring admin-managed DB items.

    Any round type without active DB items falls back to the bundled starter
    content so the daily never breaks even before the bank is populated. Items
    are ordered deterministically so the same date always yields the same puzzle.
    """
    from .models import DailyItem

    pools = {round_type: [] for round_type in STATIC_POOLS}
    qs = DailyItem.objects.filter(is_active=True).order_by('item_id')
    for item in qs:
        if item.round_type in pools:
            pools[item.round_type].append(item.as_item())

    for round_type, items in pools.items():
        if not items:
            pools[round_type] = STATIC_POOLS[round_type]
    return pools


def build_payload(day):
    """Build the full round list (WITH answers) for a given date.

    Deterministic: the same date always yields the same puzzle.
    """
    rng = _seeded_rng(day)
    pools = active_pools()
    used = set()
    rounds = []

    for slot, round_type in enumerate(ROUND_PATTERN):
        pool = pools[round_type]
        # Deterministic pick that avoids repeating an item within the same day.
        candidates = [item for item in pool if item['id'] not in used]
        if not candidates:
            candidates = pool
        item = rng.choice(candidates)
        used.add(item['id'])

        rnd = dict(item)
        rnd['type'] = round_type
        rnd['index'] = slot

        if round_type == 'sequence':
            display = list(item['items'])
            rng.shuffle(display)
            # Guard against the shuffle landing on the already-correct order.
            if [i['id'] for i in display] == item['order'] and len(display) > 1:
                display.append(display.pop(0))
            rnd['display_items'] = display

        rounds.append(rnd)

    return {'rounds': rounds}


def sanitize_payload(payload):
    """Strip answers/explanations so the client can't cheat or spoil rounds."""
    safe_rounds = []
    for rnd in payload['rounds']:
        rtype = rnd['type']
        base = {
            'id': rnd['id'],
            'index': rnd['index'],
            'type': rtype,
            'prompt': rnd['prompt'],
        }
        if rtype == 'estimate':
            base.update({
                'unit': rnd['unit'],
                'min': rnd['min'],
                'max': rnd['max'],
                'step': rnd['step'],
            })
        elif rtype == 'higher_lower':
            base.update({'a': rnd['a'], 'b': rnd['b']})
        elif rtype == 'sequence':
            base.update({'items': rnd['display_items']})
        safe_rounds.append(base)
    return {'rounds': safe_rounds}


# --------------------------------------------------------------------------- #
# Scoring                                                                      #
# --------------------------------------------------------------------------- #

def _score_estimate(rnd, answer):
    try:
        guess = float(answer.get('value'))
    except (TypeError, ValueError):
        return 0, 'black'
    target = float(rnd['value'])
    if target == 0:
        ratio = abs(guess - target)
    else:
        ratio = abs(guess - target) / abs(target)

    if ratio <= 0.05:
        return MAX_ROUND_POINTS, 'green'
    if ratio <= 0.15:
        return 160, 'green'
    if ratio <= 0.30:
        return 110, 'yellow'
    if ratio <= 0.60:
        return 55, 'yellow'
    return 0, 'black'


def _score_higher_lower(rnd, answer):
    pick = answer.get('value')
    if pick not in ('a', 'b'):
        return 0, 'black'
    if pick != rnd['answer']:
        return 0, 'black'
    time_ms = answer.get('time_ms')
    try:
        time_ms = int(time_ms)
    except (TypeError, ValueError):
        time_ms = 8000
    if time_ms <= 4000:
        return MAX_ROUND_POINTS, 'green'
    if time_ms <= 8000:
        return 150, 'green'
    return 110, 'yellow'


def _score_sequence(rnd, answer):
    submitted = answer.get('order')
    correct = rnd['order']
    if not isinstance(submitted, list) or len(submitted) != len(correct):
        return 0, 'black'
    matches = sum(1 for i, item_id in enumerate(submitted) if item_id == correct[i])
    frac = matches / len(correct)
    points = round(frac * MAX_ROUND_POINTS)
    if frac >= 0.999:
        color = 'green'
    elif frac >= 0.5:
        color = 'yellow'
    else:
        color = 'black'
    return points, color


_SCORERS = {
    'estimate': _score_estimate,
    'higher_lower': _score_higher_lower,
    'sequence': _score_sequence,
}


def score_submission(payload, answers):
    """Score a full submission.

    ``answers`` is a list of dicts keyed loosely by round id (falls back to
    positional order). Returns (total_score, results, grid).
    """
    by_id = {}
    for i, ans in enumerate(answers or []):
        if isinstance(ans, dict):
            by_id[ans.get('id', i)] = ans

    rounds = payload['rounds']
    results = []
    total = 0
    grid_parts = []

    for i, rnd in enumerate(rounds):
        answer = by_id.get(rnd['id']) or (answers[i] if answers and i < len(answers) else {})
        if not isinstance(answer, dict):
            answer = {}
        points, color = _SCORERS[rnd['type']](rnd, answer)
        total += points
        grid_parts.append(COLOR_EMOJI[color])

        result = {
            'id': rnd['id'],
            'type': rnd['type'],
            'prompt': rnd['prompt'],
            'points': points,
            'color': color,
            'fact': rnd.get('fact', ''),
        }
        if rnd['type'] == 'estimate':
            result['correct_value'] = rnd['value']
            result['unit'] = rnd['unit']
            result['guess'] = answer.get('value')
        elif rnd['type'] == 'higher_lower':
            result['correct'] = rnd['answer']
            result['picked'] = answer.get('value')
            result['a'] = rnd['a']
            result['b'] = rnd['b']
        elif rnd['type'] == 'sequence':
            result['correct_order'] = rnd['order']
            result['submitted_order'] = answer.get('order')
            result['items'] = {it['id']: it for it in rnd['items']}
        results.append(result)

    return total, results, ''.join(grid_parts)


def max_total():
    return len(ROUND_PATTERN) * MAX_ROUND_POINTS
