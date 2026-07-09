"""Parse, validate, and import Daily puzzle items from JSON.

The JSON is an array of objects. Every object needs ``type``, ``id``, ``prompt``
and a ``fact``, plus the fields specific to its round type:

estimate:
    { "type": "estimate", "id": "est_gym", "prompt": "…?",
      "value": 50, "unit": "money", "min": 0, "max": 200, "step": 5,
      "fact": "…" }
    unit is one of: money | percent | years | months | plain

higher_lower:
    { "type": "higher_lower", "id": "hl_x", "prompt": "…?",
      "a": {"label": "Credit card", "emoji": "💳"},
      "b": {"label": "Mortgage", "emoji": "🏠"},
      "answer": "a", "fact": "…" }
    answer is "a" or "b" (the correct / bigger option)

sequence:
    { "type": "sequence", "id": "seq_x", "prompt": "…?",
      "items": [ {"id":"a","label":"…","emoji":"🏦"}, … ],
      "order": ["a", "b", "c", "d"], "fact": "…" }
    order is the correct ordering of the item ids.
"""
import json

VALID_UNITS = {'money', 'percent', 'years', 'months', 'plain'}
VALID_TYPES = {'estimate', 'higher_lower', 'sequence'}

# Paste this into ChatGPT / Claude to generate a batch, then paste the JSON it
# returns into the admin "Bulk import" box. Tweak the counts as you like — for
# ~6 months of variety aim for roughly 120 estimate, 120 higher_lower, 60
# sequence items in total (split across as many batches as you want).
AI_PROMPT = r"""You are writing content for "MoneyBot Daily", a Wordle-style daily
personal-finance puzzle for a general audience (US-focused). Generate a set of
puzzle items as a single JSON array and NOTHING else (no markdown, no commentary).

Please generate: 30 "estimate", 30 "higher_lower", and 15 "sequence" items.

Rules for ALL items:
- Every item needs: "type", "id", "prompt", and "fact".
- "id": a short unique snake_case slug prefixed by type, e.g. "est_gym_membership",
  "hl_rent_vs_mortgage", "seq_debt_payoff". Ids must be globally unique.
- "prompt": a short, punchy question (<= 120 chars).
- "fact": one sentence (<= 140 chars) explaining the answer, shown after they play.
- Keep facts accurate and roughly current for the US. Prefer timeless rules of
  thumb over exact figures that go stale.
- Beginner-friendly, encouraging tone. No politics. Cover budgeting, saving,
  debt, credit, investing, taxes basics, insurance basics, and everyday spending.

Type-specific fields:

1) "estimate" — user drags a slider to guess a number.
   Fields: "value" (the correct answer, a number),
           "unit": one of "money" | "percent" | "years" | "months" | "plain",
           "min", "max" (slider range that comfortably brackets the value),
           "step" (slider granularity).
   Example:
   { "type":"estimate", "id":"est_gym_membership",
     "prompt":"About how much does the average US gym membership cost per month?",
     "value":50, "unit":"money", "min":0, "max":200, "step":5,
     "fact":"Around $50/month — and most people massively underuse it." }

2) "higher_lower" — user taps which of two options is bigger/higher on the metric.
   Fields: "a": {"label": "...", "emoji": "..."},
           "b": {"label": "...", "emoji": "..."},
           "answer": "a" or "b"  (the correct/bigger option).
   Example:
   { "type":"higher_lower",
     "id":"hl_card_vs_mortgage",
     "prompt":"Which usually charges the HIGHER interest rate?",
     "a":{"label":"Credit card","emoji":"💳"},
     "b":{"label":"Home mortgage","emoji":"🏠"},
     "answer":"a",
     "fact":"Credit cards often run 20%+ APR; mortgages are far lower." }

3) "sequence" — user drags items into the correct order.
   Fields: "items": list of {"id","label","emoji"} (3-5 entries),
           "order": the list of item ids in the CORRECT order (matches the prompt).
   Example:
   { "type":"sequence",
     "id":"seq_risk_ladder",
     "prompt":"Tap these from LOWEST risk to HIGHEST risk.",
     "items":[
       {"id":"savings","label":"Savings account","emoji":"🏦"},
       {"id":"bonds","label":"Government bonds","emoji":"📜"},
       {"id":"index","label":"Index funds","emoji":"📈"},
       {"id":"crypto","label":"A single crypto coin","emoji":"🎢"}],
     "order":["savings","bonds","index","crypto"],
     "fact":"Higher potential return almost always comes with higher risk." }

Output ONLY the JSON array."""


class ImportError_(Exception):
    """Raised with a human-readable message when parsing/validation fails."""


def _require(cond, msg):
    if not cond:
        raise ImportError_(msg)


def _is_number(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def _validate_estimate(obj, where):
    _require(_is_number(obj.get('value')), f'{where}: "value" must be a number')
    _require(obj.get('unit') in VALID_UNITS,
             f'{where}: "unit" must be one of {sorted(VALID_UNITS)}')
    for key in ('min', 'max', 'step'):
        _require(_is_number(obj.get(key)), f'{where}: "{key}" must be a number')
    _require(obj['min'] < obj['max'], f'{where}: "min" must be less than "max"')
    _require(obj['step'] > 0, f'{where}: "step" must be positive')


def _validate_option(opt, where, side):
    _require(isinstance(opt, dict), f'{where}: "{side}" must be an object')
    _require(isinstance(opt.get('label'), str) and opt['label'].strip(),
             f'{where}: "{side}.label" is required')


def _validate_higher_lower(obj, where):
    _validate_option(obj.get('a'), where, 'a')
    _validate_option(obj.get('b'), where, 'b')
    _require(obj.get('answer') in ('a', 'b'),
             f'{where}: "answer" must be "a" or "b"')


def _validate_sequence(obj, where):
    items = obj.get('items')
    _require(isinstance(items, list) and len(items) >= 2,
             f'{where}: "items" must be a list of at least 2 entries')
    ids = []
    for i, it in enumerate(items):
        _require(isinstance(it, dict), f'{where}: items[{i}] must be an object')
        _require(isinstance(it.get('id'), str) and it['id'].strip(),
                 f'{where}: items[{i}].id is required')
        _require(isinstance(it.get('label'), str) and it['label'].strip(),
                 f'{where}: items[{i}].label is required')
        ids.append(it['id'])
    _require(len(set(ids)) == len(ids), f'{where}: item ids must be unique')
    order = obj.get('order')
    _require(isinstance(order, list), f'{where}: "order" must be a list of item ids')
    _require(sorted(order) == sorted(ids),
             f'{where}: "order" must be a permutation of the item ids {ids}')


_VALIDATORS = {
    'estimate': _validate_estimate,
    'higher_lower': _validate_higher_lower,
    'sequence': _validate_sequence,
}

# Keys that live as columns on the model rather than inside `data`.
_COLUMN_KEYS = {'type', 'id', 'prompt'}


def parse(raw):
    """Parse a JSON string (or already-decoded list) into validated records.

    Returns a list of dicts: {round_type, item_id, prompt, data}. Raises
    ImportError_ with a friendly message on any problem.
    """
    if isinstance(raw, str):
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ImportError_(f'Invalid JSON: {exc}')
    else:
        data = raw

    if isinstance(data, dict):
        data = [data]
    _require(isinstance(data, list) and data, 'Expected a non-empty JSON array of items')

    records = []
    seen_ids = set()
    for idx, obj in enumerate(data):
        where = f'item #{idx + 1}'
        _require(isinstance(obj, dict), f'{where}: must be an object')
        rtype = obj.get('type')
        _require(rtype in VALID_TYPES,
                 f'{where}: "type" must be one of {sorted(VALID_TYPES)} (got {rtype!r})')
        item_id = obj.get('id')
        _require(isinstance(item_id, str) and item_id.strip(),
                 f'{where}: "id" is required')
        _require(item_id not in seen_ids, f'{where}: duplicate id "{item_id}" in this batch')
        seen_ids.add(item_id)
        prompt = obj.get('prompt')
        _require(isinstance(prompt, str) and prompt.strip(),
                 f'{where}: "prompt" is required')
        _require(isinstance(obj.get('fact'), str) and obj['fact'].strip(),
                 f'{where}: "fact" is required (shown after the round)')

        _VALIDATORS[rtype](obj, where)

        payload = {k: v for k, v in obj.items() if k not in _COLUMN_KEYS}
        records.append({
            'round_type': rtype,
            'item_id': item_id.strip(),
            'prompt': prompt.strip(),
            'data': payload,
        })
    return records


def import_records(records):
    """Upsert validated records into the DailyItem table.

    Returns (created_count, updated_count).
    """
    from .models import DailyItem

    created = updated = 0
    for rec in records:
        obj, was_created = DailyItem.objects.update_or_create(
            item_id=rec['item_id'],
            defaults={
                'round_type': rec['round_type'],
                'prompt': rec['prompt'],
                'data': rec['data'],
                'is_active': True,
            },
        )
        if was_created:
            created += 1
        else:
            updated += 1
    return created, updated


def import_json(raw):
    """Convenience: parse + import in one call. Returns (created, updated)."""
    return import_records(parse(raw))
