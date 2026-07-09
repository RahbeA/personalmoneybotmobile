"""Content pools for the MoneyBot Daily challenge.

Every daily puzzle mixes three interactive round types (no plain multiple
choice). Items are deterministically selected per calendar date so every user
sees the exact same puzzle (Wordle-style). Answers live here on the server and
are stripped before the payload is sent to the client.

Round types
-----------
- ``estimate``      : drag a slider to guess a real-world money figure.
- ``higher_lower``  : tap which of two things is bigger on some metric.
- ``sequence``      : tap items into the correct order (rank it).
"""

# ---------------------------------------------------------------------------
# Estimate rounds — guess a number, scored by closeness.
#   value : the correct answer
#   unit  : 'money' | 'percent' | 'years' | 'months' | 'plain'
#   min/max/step define the slider range
# ---------------------------------------------------------------------------
ESTIMATE_ITEMS = [
    {
        'id': 'est_coffee',
        'prompt': 'A $5 coffee every single day adds up to about how much in one year?',
        'value': 1825, 'unit': 'money', 'min': 0, 'max': 4000, 'step': 25,
        'fact': '$5 × 365 = $1,825. Small daily habits are the sneakiest budget leak.',
    },
    {
        'id': 'est_save_pct',
        'prompt': 'What percentage of your income do experts commonly suggest you save?',
        'value': 20, 'unit': 'percent', 'min': 0, 'max': 50, 'step': 1,
        'fact': 'The 50/30/20 rule puts 20% toward savings and debt payoff.',
    },
    {
        'id': 'est_rule72',
        'prompt': 'At a 7% annual return, roughly how many years to DOUBLE your money?',
        'value': 10, 'unit': 'years', 'min': 1, 'max': 30, 'step': 1,
        'fact': 'Rule of 72: 72 ÷ 7 ≈ 10 years to double.',
    },
    {
        'id': 'est_emergency',
        'prompt': 'A full emergency fund covers about how many months of expenses?',
        'value': 6, 'unit': 'months', 'min': 0, 'max': 12, 'step': 1,
        'fact': 'Most planners aim for 3–6 months of essential expenses.',
    },
    {
        'id': 'est_cc_debt',
        'prompt': 'Average U.S. household credit card debt is closest to…?',
        'value': 6500, 'unit': 'money', 'min': 0, 'max': 15000, 'step': 250,
        'fact': 'The average balance hovers around $6,000–$7,000 per household.',
    },
    {
        'id': 'est_rent',
        'prompt': 'Average U.S. monthly rent for a one-bedroom apartment?',
        'value': 1500, 'unit': 'money', 'min': 500, 'max': 3500, 'step': 50,
        'fact': 'Housing is most people\u2019s single biggest monthly expense.',
    },
    {
        'id': 'est_new_car',
        'prompt': 'The average price of a NEW car in the U.S. is closest to…?',
        'value': 48000, 'unit': 'money', 'min': 15000, 'max': 90000, 'step': 1000,
        'fact': 'New cars average around $48k — a big reason many buy used.',
    },
    {
        'id': 'est_wedding',
        'prompt': 'The average U.S. wedding costs about…?',
        'value': 30000, 'unit': 'money', 'min': 0, 'max': 70000, 'step': 1000,
        'fact': 'The average wedding runs ~$30k. Guest count drives most of it.',
    },
    {
        'id': 'est_student_loan',
        'prompt': 'Average federal student loan debt per borrower?',
        'value': 38000, 'unit': 'money', 'min': 0, 'max': 80000, 'step': 1000,
        'fact': 'The typical borrower owes around $37k–$38k.',
    },
    {
        'id': 'est_401k_match',
        'prompt': 'A very common 401(k) employer match is what percent of your salary?',
        'value': 5, 'unit': 'percent', 'min': 0, 'max': 15, 'step': 1,
        'fact': 'Many employers match ~50% of contributions up to ~5%. Free money!',
    },
    {
        'id': 'est_credit_util',
        'prompt': 'To protect your credit score, keep card utilization UNDER what percent?',
        'value': 30, 'unit': 'percent', 'min': 0, 'max': 100, 'step': 5,
        'fact': 'Under 30% utilization is the classic rule; lower is even better.',
    },
    {
        'id': 'est_latte_invested',
        'prompt': 'If you invested $2,000/yr at 8% for 30 years, it grows to roughly…?',
        'value': 226000, 'unit': 'money', 'min': 60000, 'max': 500000, 'step': 5000,
        'fact': 'About $226k — compounding does the heavy lifting over decades.',
    },
]

# ---------------------------------------------------------------------------
# Higher / Lower rounds — pick which option scores higher on the metric.
#   answer : 'a' or 'b' (the correct pick)
# ---------------------------------------------------------------------------
HIGHER_LOWER_ITEMS = [
    {
        'id': 'hl_interest',
        'prompt': 'Which usually charges the HIGHER interest rate?',
        'a': {'label': 'Credit card', 'emoji': '💳'},
        'b': {'label': 'Home mortgage', 'emoji': '🏠'},
        'answer': 'a',
        'fact': 'Credit cards often run 20%+ APR; mortgages are far lower.',
    },
    {
        'id': 'hl_growth',
        'prompt': 'Over 30 years, which typically GROWS more?',
        'a': {'label': 'S&P 500 index fund', 'emoji': '📈'},
        'b': {'label': 'Basic savings account', 'emoji': '🏦'},
        'answer': 'a',
        'fact': 'Stocks have historically averaged ~10%/yr vs. ~0.5% for savings.',
    },
    {
        'id': 'hl_fees',
        'prompt': 'Which usually has HIGHER fees?',
        'a': {'label': 'Actively managed fund', 'emoji': '🧑\u200d💼'},
        'b': {'label': 'Index fund', 'emoji': '🤖'},
        'answer': 'a',
        'fact': 'Active funds charge more but rarely beat cheap index funds.',
    },
    {
        'id': 'hl_return',
        'prompt': 'Which has the HIGHER average annual return historically?',
        'a': {'label': 'Stocks', 'emoji': '📊'},
        'b': {'label': 'Government bonds', 'emoji': '📜'},
        'answer': 'a',
        'fact': 'Stocks return more on average — but with bigger swings.',
    },
    {
        'id': 'hl_apr',
        'prompt': 'Which APR is WORSE for your wallet?',
        'a': {'label': '24% credit card', 'emoji': '💳'},
        'b': {'label': '6% car loan', 'emoji': '🚗'},
        'answer': 'a',
        'fact': 'Higher APR = more interest. Attack the 24% debt first.',
    },
    {
        'id': 'hl_limit',
        'prompt': 'Which has the HIGHER 2024 contribution limit?',
        'a': {'label': '401(k) — $23,000', 'emoji': '🏢'},
        'b': {'label': 'IRA — $7,000', 'emoji': '🐷'},
        'answer': 'a',
        'fact': 'The 401(k) lets you stash far more tax-advantaged each year.',
    },
    {
        'id': 'hl_liquid',
        'prompt': 'Which can you turn into cash FASTER?',
        'a': {'label': 'Checking account', 'emoji': '💵'},
        'b': {'label': 'A house', 'emoji': '🏡'},
        'answer': 'a',
        'fact': 'Liquidity matters — property can take months to sell.',
    },
    {
        'id': 'hl_cost',
        'prompt': 'Which typically costs MORE per year?',
        'a': {'label': 'Owning a car', 'emoji': '🚙'},
        'b': {'label': 'A monthly transit pass', 'emoji': '🚌'},
        'answer': 'a',
        'fact': 'Gas, insurance, and repairs make car ownership pricey.',
    },
    {
        'id': 'hl_brand',
        'prompt': 'Which is usually MORE expensive at the store?',
        'a': {'label': 'Brand-name cereal', 'emoji': '🥣'},
        'b': {'label': 'Store-brand cereal', 'emoji': '🛒'},
        'answer': 'a',
        'fact': 'Store brands are often the same product for less money.',
    },
    {
        'id': 'hl_compound',
        'prompt': 'Who ends up with MORE, all else equal?',
        'a': {'label': 'Starts investing at 25', 'emoji': '🌱'},
        'b': {'label': 'Starts investing at 35', 'emoji': '⏳'},
        'answer': 'a',
        'fact': 'Ten extra years of compounding is a massive head start.',
    },
]

# ---------------------------------------------------------------------------
# Sequence rounds — tap items into the correct order.
#   order : list of item ids in the CORRECT sequence (matches the prompt)
# ---------------------------------------------------------------------------
SEQUENCE_ITEMS = [
    {
        'id': 'seq_risk',
        'prompt': 'Tap these from LOWEST risk to HIGHEST risk.',
        'items': [
            {'id': 'savings', 'label': 'Savings account', 'emoji': '🏦'},
            {'id': 'bonds', 'label': 'Government bonds', 'emoji': '📜'},
            {'id': 'index', 'label': 'Index funds', 'emoji': '📈'},
            {'id': 'crypto', 'label': 'A single crypto coin', 'emoji': '🎢'},
        ],
        'order': ['savings', 'bonds', 'index', 'crypto'],
        'fact': 'Higher potential return almost always comes with higher risk.',
    },
    {
        'id': 'seq_rates',
        'prompt': 'Order these loans by interest rate: LOWEST to HIGHEST.',
        'items': [
            {'id': 'mortgage', 'label': 'Mortgage', 'emoji': '🏠'},
            {'id': 'student', 'label': 'Student loan', 'emoji': '🎓'},
            {'id': 'car', 'label': 'Car loan', 'emoji': '🚗'},
            {'id': 'card', 'label': 'Credit card', 'emoji': '💳'},
        ],
        'order': ['mortgage', 'student', 'car', 'card'],
        'fact': 'Secured debt (backed by an asset) is usually cheaper than a card.',
    },
    {
        'id': 'seq_steps',
        'prompt': 'Order the smart money steps: FIRST to LAST.',
        'items': [
            {'id': 'track', 'label': 'Track your spending', 'emoji': '🔍'},
            {'id': 'budget', 'label': 'Set a budget', 'emoji': '🧾'},
            {'id': 'fund', 'label': 'Build emergency fund', 'emoji': '🛡️'},
            {'id': 'invest', 'label': 'Invest for the future', 'emoji': '🚀'},
        ],
        'order': ['track', 'budget', 'fund', 'invest'],
        'fact': 'You can\u2019t budget what you don\u2019t measure — tracking comes first.',
    },
    {
        'id': 'seq_liquid',
        'prompt': 'Order by how FAST you can access the cash: FASTEST first.',
        'items': [
            {'id': 'checking', 'label': 'Checking account', 'emoji': '💵'},
            {'id': 'savings', 'label': 'Savings account', 'emoji': '🏦'},
            {'id': 'stocks', 'label': 'Stocks', 'emoji': '📊'},
            {'id': 'home', 'label': 'Real estate', 'emoji': '🏡'},
        ],
        'order': ['checking', 'savings', 'stocks', 'home'],
        'fact': 'That ease of access is called liquidity.',
    },
    {
        'id': 'seq_priority',
        'prompt': 'Order these payoff priorities: MOST urgent first.',
        'items': [
            {'id': 'card', 'label': '24% credit card', 'emoji': '💳'},
            {'id': 'car', 'label': '7% car loan', 'emoji': '🚗'},
            {'id': 'student', 'label': '5% student loan', 'emoji': '🎓'},
            {'id': 'mortgage', 'label': '3% mortgage', 'emoji': '🏠'},
        ],
        'order': ['card', 'car', 'student', 'mortgage'],
        'fact': 'Avalanche method: crush the highest interest rate first.',
    },
    {
        'id': 'seq_cost',
        'prompt': 'Order by typical MONTHLY cost: CHEAPEST first.',
        'items': [
            {'id': 'coffee', 'label': 'Coffee habit', 'emoji': '☕'},
            {'id': 'phone', 'label': 'Phone bill', 'emoji': '📱'},
            {'id': 'car', 'label': 'Car payment', 'emoji': '🚗'},
            {'id': 'rent', 'label': 'Rent', 'emoji': '🏠'},
        ],
        'order': ['coffee', 'phone', 'car', 'rent'],
        'fact': 'Knowing your biggest costs tells you where to optimize.',
    },
]

POOLS = {
    'estimate': ESTIMATE_ITEMS,
    'higher_lower': HIGHER_LOWER_ITEMS,
    'sequence': SEQUENCE_ITEMS,
}

# Each daily puzzle is 5 rounds in this fixed type pattern (deterministic per
# day). Mixing types keeps it fresh; the pattern guarantees variety.
ROUND_PATTERN = ['estimate', 'higher_lower', 'sequence', 'estimate', 'higher_lower']

# Max points a single round can earn. Total possible = len(ROUND_PATTERN) * 200.
MAX_ROUND_POINTS = 200
