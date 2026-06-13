from django.core.management.base import BaseCommand
from courses.models import Module, Lesson, Question, Answer


COURSE_DATA = [
    {
        "title": "Budgeting Basics",
        "description": "Learn how to create and stick to a budget that works for you.",
        "icon": "💰",
        "order": 1,
        "lessons": [
            {
                "title": "What is a Budget?",
                "order": 1,
                "questions": [
                    {
                        "type": "true_false",
                        "prompt": "A budget is a plan for how you will spend and save your money.",
                        "explanation": "Correct! A budget is exactly that — a financial plan that helps you allocate your income.",
                        "order": 1,
                        "answers": [
                            {"text": "True", "is_correct": True},
                            {"text": "False", "is_correct": False},
                        ],
                    },
                    {
                        "type": "mcq",
                        "prompt": "Which of the following best describes the purpose of a budget?",
                        "explanation": "A budget helps you control spending, reduce debt, and reach savings goals.",
                        "order": 2,
                        "answers": [
                            {"text": "To restrict all spending", "is_correct": False},
                            {"text": "To track and plan your income and expenses", "is_correct": True},
                            {"text": "To invest in the stock market", "is_correct": False},
                            {"text": "To apply for a loan", "is_correct": False},
                        ],
                    },
                    {
                        "type": "true_false",
                        "prompt": "You need to earn a lot of money before a budget becomes useful.",
                        "explanation": "False! Budgeting is valuable at any income level. It helps you make the most of what you have.",
                        "order": 3,
                        "answers": [
                            {"text": "True", "is_correct": False},
                            {"text": "False", "is_correct": True},
                        ],
                    },
                    {
                        "type": "select_all",
                        "prompt": "Select all the benefits of having a budget.",
                        "explanation": "Budgets help you reduce stress, reach goals, avoid debt, and understand your spending habits.",
                        "order": 4,
                        "answers": [
                            {"text": "Helps you reach financial goals", "is_correct": True},
                            {"text": "Reduces financial stress", "is_correct": True},
                            {"text": "Guarantees you'll become rich", "is_correct": False},
                            {"text": "Prevents overspending", "is_correct": True},
                        ],
                    },
                    {
                        "type": "mcq",
                        "prompt": "What is the first step in creating a budget?",
                        "explanation": "You need to know how much money you bring in before you can allocate it.",
                        "order": 5,
                        "answers": [
                            {"text": "List all your expenses", "is_correct": False},
                            {"text": "Open a savings account", "is_correct": False},
                            {"text": "Calculate your total monthly income", "is_correct": True},
                            {"text": "Cut all subscriptions", "is_correct": False},
                        ],
                    },
                ],
            },
            {
                "title": "Tracking Expenses",
                "order": 2,
                "questions": [
                    {
                        "type": "mcq",
                        "prompt": "What are 'fixed expenses'?",
                        "explanation": "Fixed expenses stay the same each month, like rent or a car payment.",
                        "order": 1,
                        "answers": [
                            {"text": "Expenses that change each month", "is_correct": False},
                            {"text": "Expenses that stay the same each month", "is_correct": True},
                            {"text": "Unexpected emergency costs", "is_correct": False},
                            {"text": "Spending on luxuries", "is_correct": False},
                        ],
                    },
                    {
                        "type": "select_all",
                        "prompt": "Which of these are examples of variable expenses?",
                        "explanation": "Variable expenses fluctuate month to month — groceries, entertainment, and dining out all vary.",
                        "order": 2,
                        "answers": [
                            {"text": "Groceries", "is_correct": True},
                            {"text": "Monthly rent", "is_correct": False},
                            {"text": "Entertainment", "is_correct": True},
                            {"text": "Dining out", "is_correct": True},
                        ],
                    },
                    {
                        "type": "true_false",
                        "prompt": "Tracking small daily purchases like coffee has no meaningful impact on your budget.",
                        "explanation": "False! Small daily spending adds up quickly. $5/day is $1,825 per year.",
                        "order": 3,
                        "answers": [
                            {"text": "True", "is_correct": False},
                            {"text": "False", "is_correct": True},
                        ],
                    },
                    {
                        "type": "mcq",
                        "prompt": "How often should you review your budget?",
                        "explanation": "Monthly reviews help you catch overspending and adjust before it becomes a problem.",
                        "order": 4,
                        "answers": [
                            {"text": "Once a year", "is_correct": False},
                            {"text": "Only when you run out of money", "is_correct": False},
                            {"text": "Monthly, at minimum", "is_correct": True},
                            {"text": "Every 5 years", "is_correct": False},
                        ],
                    },
                    {
                        "type": "true_false",
                        "prompt": "Budgeting apps can automatically categorize your transactions.",
                        "explanation": "True! Apps like Mint or YNAB connect to your bank and categorize spending automatically.",
                        "order": 5,
                        "answers": [
                            {"text": "True", "is_correct": True},
                            {"text": "False", "is_correct": False},
                        ],
                    },
                ],
            },
            {
                "title": "The 50/30/20 Rule",
                "order": 3,
                "questions": [
                    {
                        "type": "mcq",
                        "prompt": "In the 50/30/20 rule, what does the '50' represent?",
                        "explanation": "50% of after-tax income goes to needs — essentials like housing, food, utilities.",
                        "order": 1,
                        "answers": [
                            {"text": "50% toward wants", "is_correct": False},
                            {"text": "50% toward savings", "is_correct": False},
                            {"text": "50% toward needs", "is_correct": True},
                            {"text": "50% toward investments", "is_correct": False},
                        ],
                    },
                    {
                        "type": "true_false",
                        "prompt": "Dining at a restaurant is considered a 'need' in the 50/30/20 framework.",
                        "explanation": "False! Dining out is a 'want.' Groceries are a need, but eating out is discretionary spending.",
                        "order": 2,
                        "answers": [
                            {"text": "True", "is_correct": False},
                            {"text": "False", "is_correct": True},
                        ],
                    },
                    {
                        "type": "select_all",
                        "prompt": "Which of these fall under the '20%' savings category?",
                        "explanation": "The 20% covers emergency fund contributions, retirement savings, and debt repayment.",
                        "order": 3,
                        "answers": [
                            {"text": "Emergency fund", "is_correct": True},
                            {"text": "Streaming subscriptions", "is_correct": False},
                            {"text": "Retirement contributions (401k/IRA)", "is_correct": True},
                            {"text": "Paying off credit card debt", "is_correct": True},
                        ],
                    },
                    {
                        "type": "mcq",
                        "prompt": "If your monthly take-home pay is $3,000, how much should go to wants?",
                        "explanation": "$3,000 × 30% = $900 for wants — things like dining out, hobbies, and entertainment.",
                        "order": 4,
                        "answers": [
                            {"text": "$600", "is_correct": False},
                            {"text": "$900", "is_correct": True},
                            {"text": "$1,500", "is_correct": False},
                            {"text": "$1,200", "is_correct": False},
                        ],
                    },
                    {
                        "type": "true_false",
                        "prompt": "The 50/30/20 rule can be adjusted based on your personal situation.",
                        "explanation": "True! It's a guideline, not a law. High-cost cities or debt situations may require different splits.",
                        "order": 5,
                        "answers": [
                            {"text": "True", "is_correct": True},
                            {"text": "False", "is_correct": False},
                        ],
                    },
                ],
            },
        ],
    },
    {
        "title": "Saving & Investing",
        "description": "Discover how to grow your money through saving and smart investing.",
        "icon": "📈",
        "order": 2,
        "lessons": [
            {
                "title": "Emergency Fund",
                "order": 1,
                "questions": [
                    {
                        "type": "mcq",
                        "prompt": "How many months of expenses should an emergency fund cover?",
                        "explanation": "Most financial experts recommend 3–6 months of living expenses in an emergency fund.",
                        "order": 1,
                        "answers": [
                            {"text": "1 month", "is_correct": False},
                            {"text": "3–6 months", "is_correct": True},
                            {"text": "10–12 months", "is_correct": False},
                            {"text": "Just $500", "is_correct": False},
                        ],
                    },
                    {
                        "type": "true_false",
                        "prompt": "An emergency fund should be invested in the stock market for maximum returns.",
                        "explanation": "False! Emergency funds should be in liquid, stable accounts like high-yield savings — not the stock market.",
                        "order": 2,
                        "answers": [
                            {"text": "True", "is_correct": False},
                            {"text": "False", "is_correct": True},
                        ],
                    },
                    {
                        "type": "select_all",
                        "prompt": "Which situations justify using your emergency fund?",
                        "explanation": "Emergency funds are for true emergencies — job loss, medical bills, urgent car/home repairs.",
                        "order": 3,
                        "answers": [
                            {"text": "Job loss", "is_correct": True},
                            {"text": "Vacation", "is_correct": False},
                            {"text": "Unexpected medical bill", "is_correct": True},
                            {"text": "Car breakdown", "is_correct": True},
                        ],
                    },
                    {
                        "type": "mcq",
                        "prompt": "Where is the best place to keep your emergency fund?",
                        "explanation": "A high-yield savings account offers easy access plus better interest than a regular checking account.",
                        "order": 4,
                        "answers": [
                            {"text": "Under your mattress", "is_correct": False},
                            {"text": "In stocks", "is_correct": False},
                            {"text": "High-yield savings account", "is_correct": True},
                            {"text": "In a retirement account", "is_correct": False},
                        ],
                    },
                    {
                        "type": "true_false",
                        "prompt": "Building an emergency fund should come before paying off all debt.",
                        "explanation": "Generally true for a starter fund ($1,000). After that, focus on high-interest debt, then grow the fund.",
                        "order": 5,
                        "answers": [
                            {"text": "True", "is_correct": True},
                            {"text": "False", "is_correct": False},
                        ],
                    },
                ],
            },
            {
                "title": "Compound Interest",
                "order": 2,
                "questions": [
                    {
                        "type": "mcq",
                        "prompt": "What is compound interest?",
                        "explanation": "Compound interest means you earn interest on your original money AND on the interest already earned.",
                        "order": 1,
                        "answers": [
                            {"text": "Interest paid only on the original principal", "is_correct": False},
                            {"text": "Interest earned on both principal and accumulated interest", "is_correct": True},
                            {"text": "A fixed fee charged by banks", "is_correct": False},
                            {"text": "A government tax on savings", "is_correct": False},
                        ],
                    },
                    {
                        "type": "true_false",
                        "prompt": "Starting to save earlier leads to significantly more wealth over time due to compound interest.",
                        "explanation": "True! Saving at 22 vs 32 can result in double the wealth by retirement, even with the same contributions.",
                        "order": 2,
                        "answers": [
                            {"text": "True", "is_correct": True},
                            {"text": "False", "is_correct": False},
                        ],
                    },
                    {
                        "type": "mcq",
                        "prompt": "The 'Rule of 72' helps you estimate what?",
                        "explanation": "Divide 72 by your annual interest rate to see approximately how many years to double your money.",
                        "order": 3,
                        "answers": [
                            {"text": "How much tax you owe", "is_correct": False},
                            {"text": "How long it takes to double your money", "is_correct": True},
                            {"text": "How to calculate your credit score", "is_correct": False},
                            {"text": "Your retirement age", "is_correct": False},
                        ],
                    },
                    {
                        "type": "select_all",
                        "prompt": "Which factors increase the power of compound interest?",
                        "explanation": "Higher rate, longer time, and more frequent compounding all accelerate growth.",
                        "order": 4,
                        "answers": [
                            {"text": "Higher interest rate", "is_correct": True},
                            {"text": "Longer time horizon", "is_correct": True},
                            {"text": "Withdrawing interest monthly", "is_correct": False},
                            {"text": "More frequent compounding", "is_correct": True},
                        ],
                    },
                    {
                        "type": "true_false",
                        "prompt": "Compound interest only benefits savers, never borrowers.",
                        "explanation": "False! Compound interest works against borrowers too — credit card debt compounds and grows quickly.",
                        "order": 5,
                        "answers": [
                            {"text": "True", "is_correct": False},
                            {"text": "False", "is_correct": True},
                        ],
                    },
                ],
            },
            {
                "title": "Intro to Stocks",
                "order": 3,
                "questions": [
                    {
                        "type": "mcq",
                        "prompt": "What does owning a stock represent?",
                        "explanation": "A share of stock means you own a small piece of that company and share in its profits and losses.",
                        "order": 1,
                        "answers": [
                            {"text": "A loan you gave to a company", "is_correct": False},
                            {"text": "Ownership of a small piece of a company", "is_correct": True},
                            {"text": "A guaranteed return on investment", "is_correct": False},
                            {"text": "A government bond", "is_correct": False},
                        ],
                    },
                    {
                        "type": "true_false",
                        "prompt": "Index funds are a good way for beginners to invest in stocks with lower risk.",
                        "explanation": "True! Index funds spread your money across many stocks, reducing risk compared to picking individual stocks.",
                        "order": 2,
                        "answers": [
                            {"text": "True", "is_correct": True},
                            {"text": "False", "is_correct": False},
                        ],
                    },
                    {
                        "type": "select_all",
                        "prompt": "Which of these are risks associated with stock investing?",
                        "explanation": "Stock markets can be volatile, companies can go bankrupt, and short-term losses are common.",
                        "order": 3,
                        "answers": [
                            {"text": "Market volatility", "is_correct": True},
                            {"text": "Company going bankrupt", "is_correct": True},
                            {"text": "Guaranteed 10% annual return", "is_correct": False},
                            {"text": "Losing money in the short term", "is_correct": True},
                        ],
                    },
                    {
                        "type": "mcq",
                        "prompt": "What is a dividend?",
                        "explanation": "Dividends are periodic cash payments some companies make to shareholders from their profits.",
                        "order": 4,
                        "answers": [
                            {"text": "A type of stock market crash", "is_correct": False},
                            {"text": "A fee charged to buy stocks", "is_correct": False},
                            {"text": "A cash payment companies make to shareholders", "is_correct": True},
                            {"text": "A government savings program", "is_correct": False},
                        ],
                    },
                    {
                        "type": "true_false",
                        "prompt": "You need thousands of dollars to start investing in stocks.",
                        "explanation": "False! Many apps let you start with as little as $1 through fractional shares.",
                        "order": 5,
                        "answers": [
                            {"text": "True", "is_correct": False},
                            {"text": "False", "is_correct": True},
                        ],
                    },
                ],
            },
        ],
    },
    {
        "title": "Credit & Debt",
        "description": "Master your credit score and learn to manage debt effectively.",
        "icon": "💳",
        "order": 3,
        "lessons": [
            {
                "title": "Understanding Credit Scores",
                "order": 1,
                "questions": [
                    {
                        "type": "mcq",
                        "prompt": "What credit score is generally considered 'good'?",
                        "explanation": "Scores range from 300–850. A score of 670–739 is good; 740+ is very good or exceptional.",
                        "order": 1,
                        "answers": [
                            {"text": "300–450", "is_correct": False},
                            {"text": "500–580", "is_correct": False},
                            {"text": "670–739", "is_correct": True},
                            {"text": "100–200", "is_correct": False},
                        ],
                    },
                    {
                        "type": "select_all",
                        "prompt": "Which factors make up your FICO credit score?",
                        "explanation": "Payment history (35%), amounts owed (30%), length of history (15%), new credit (10%), credit mix (10%).",
                        "order": 2,
                        "answers": [
                            {"text": "Payment history", "is_correct": True},
                            {"text": "Your income level", "is_correct": False},
                            {"text": "Amounts owed", "is_correct": True},
                            {"text": "Length of credit history", "is_correct": True},
                        ],
                    },
                    {
                        "type": "true_false",
                        "prompt": "Checking your own credit score will lower it.",
                        "explanation": "False! Checking your own score is a 'soft inquiry' and does NOT affect your credit score.",
                        "order": 3,
                        "answers": [
                            {"text": "True", "is_correct": False},
                            {"text": "False", "is_correct": True},
                        ],
                    },
                    {
                        "type": "mcq",
                        "prompt": "Which action has the biggest positive impact on your credit score?",
                        "explanation": "Payment history is 35% of your score. Paying on time, every time, is the most impactful habit.",
                        "order": 4,
                        "answers": [
                            {"text": "Applying for many credit cards", "is_correct": False},
                            {"text": "Paying all bills on time", "is_correct": True},
                            {"text": "Closing old accounts", "is_correct": False},
                            {"text": "Using 90% of your credit limit", "is_correct": False},
                        ],
                    },
                    {
                        "type": "true_false",
                        "prompt": "A higher credit score typically means lower interest rates on loans.",
                        "explanation": "True! Lenders reward low-risk borrowers (high scores) with better interest rates.",
                        "order": 5,
                        "answers": [
                            {"text": "True", "is_correct": True},
                            {"text": "False", "is_correct": False},
                        ],
                    },
                ],
            },
            {
                "title": "Good Debt vs Bad Debt",
                "order": 2,
                "questions": [
                    {
                        "type": "mcq",
                        "prompt": "Which of these is typically considered 'good debt'?",
                        "explanation": "Student loans and mortgages can build value or increase earning potential — these are considered 'good debt'.",
                        "order": 1,
                        "answers": [
                            {"text": "High-interest credit card debt", "is_correct": False},
                            {"text": "Payday loan", "is_correct": False},
                            {"text": "Student loan for a marketable degree", "is_correct": True},
                            {"text": "Store financing at 30% APR", "is_correct": False},
                        ],
                    },
                    {
                        "type": "true_false",
                        "prompt": "Payday loans are a safe and affordable way to borrow money.",
                        "explanation": "False! Payday loans often carry APRs of 300–400%, making them extremely expensive and dangerous.",
                        "order": 2,
                        "answers": [
                            {"text": "True", "is_correct": False},
                            {"text": "False", "is_correct": True},
                        ],
                    },
                    {
                        "type": "select_all",
                        "prompt": "What makes debt 'bad'?",
                        "explanation": "Bad debt has high interest, depreciating assets, no income potential, and is used for wants not needs.",
                        "order": 3,
                        "answers": [
                            {"text": "Very high interest rate", "is_correct": True},
                            {"text": "Used to buy depreciating assets", "is_correct": True},
                            {"text": "Builds equity over time", "is_correct": False},
                            {"text": "Used for luxury purchases", "is_correct": True},
                        ],
                    },
                    {
                        "type": "mcq",
                        "prompt": "What is the 'debt avalanche' method?",
                        "explanation": "Debt avalanche means paying minimums on all debts but putting extra money toward the highest-interest debt first.",
                        "order": 4,
                        "answers": [
                            {"text": "Paying off the smallest balance first", "is_correct": False},
                            {"text": "Paying off the highest interest rate first", "is_correct": True},
                            {"text": "Ignoring debt until it goes away", "is_correct": False},
                            {"text": "Taking out a new loan to pay old ones", "is_correct": False},
                        ],
                    },
                    {
                        "type": "true_false",
                        "prompt": "A mortgage on a home can be considered 'good debt' because real estate typically appreciates.",
                        "explanation": "True! Mortgages often lead to equity building and the asset can appreciate in value.",
                        "order": 5,
                        "answers": [
                            {"text": "True", "is_correct": True},
                            {"text": "False", "is_correct": False},
                        ],
                    },
                ],
            },
            {
                "title": "Paying Off Debt",
                "order": 3,
                "questions": [
                    {
                        "type": "mcq",
                        "prompt": "What is the 'debt snowball' method?",
                        "explanation": "The debt snowball pays off the smallest balance first for psychological momentum, then rolls that payment to the next.",
                        "order": 1,
                        "answers": [
                            {"text": "Paying highest interest debt first", "is_correct": False},
                            {"text": "Paying the smallest balance debt first", "is_correct": True},
                            {"text": "Consolidating all debt into one loan", "is_correct": False},
                            {"text": "Skipping minimum payments", "is_correct": False},
                        ],
                    },
                    {
                        "type": "select_all",
                        "prompt": "Which strategies can help you pay off debt faster?",
                        "explanation": "Extra payments, cutting expenses, and debt consolidation (when the rate is lower) all accelerate payoff.",
                        "order": 2,
                        "answers": [
                            {"text": "Making extra payments when possible", "is_correct": True},
                            {"text": "Cutting unnecessary expenses", "is_correct": True},
                            {"text": "Opening more credit cards", "is_correct": False},
                            {"text": "Consolidating to a lower interest rate", "is_correct": True},
                        ],
                    },
                    {
                        "type": "true_false",
                        "prompt": "Making only minimum payments on credit cards is the best long-term strategy.",
                        "explanation": "False! Minimum payments keep you in debt longer and cost far more in interest over time.",
                        "order": 3,
                        "answers": [
                            {"text": "True", "is_correct": False},
                            {"text": "False", "is_correct": True},
                        ],
                    },
                    {
                        "type": "mcq",
                        "prompt": "What is debt consolidation?",
                        "explanation": "Debt consolidation combines multiple debts into one loan, ideally at a lower interest rate.",
                        "order": 4,
                        "answers": [
                            {"text": "Ignoring multiple debts", "is_correct": False},
                            {"text": "Combining multiple debts into one loan", "is_correct": True},
                            {"text": "Filing for bankruptcy", "is_correct": False},
                            {"text": "Paying debts in alphabetical order", "is_correct": False},
                        ],
                    },
                    {
                        "type": "true_false",
                        "prompt": "Your debt-to-income ratio affects your ability to get approved for new loans.",
                        "explanation": "True! Lenders review your DTI ratio (monthly debt payments / gross income) to assess risk.",
                        "order": 5,
                        "answers": [
                            {"text": "True", "is_correct": True},
                            {"text": "False", "is_correct": False},
                        ],
                    },
                ],
            },
        ],
    },
    {
        "title": "Taxes 101",
        "description": "Understand how taxes work and how to keep more of your money.",
        "icon": "🧾",
        "order": 4,
        "lessons": [
            {
                "title": "How Taxes Work",
                "order": 1,
                "questions": [
                    {
                        "type": "mcq",
                        "prompt": "The U.S. tax system is 'progressive,' meaning what?",
                        "explanation": "Progressive means higher income is taxed at higher rates, but only the income above each bracket threshold.",
                        "order": 1,
                        "answers": [
                            {"text": "Everyone pays the same flat tax rate", "is_correct": False},
                            {"text": "Higher income is taxed at higher rates", "is_correct": True},
                            {"text": "Only the wealthy pay taxes", "is_correct": False},
                            {"text": "Taxes decrease as income increases", "is_correct": False},
                        ],
                    },
                    {
                        "type": "true_false",
                        "prompt": "Your 'effective tax rate' is the same as your 'marginal tax rate'.",
                        "explanation": "False! Marginal rate is your top bracket rate. Effective rate is what you actually pay on average across all income.",
                        "order": 2,
                        "answers": [
                            {"text": "True", "is_correct": False},
                            {"text": "False", "is_correct": True},
                        ],
                    },
                    {
                        "type": "select_all",
                        "prompt": "Which of these are types of taxes most Americans pay?",
                        "explanation": "Most Americans pay federal income tax, state income tax (in most states), Social Security, and Medicare taxes.",
                        "order": 3,
                        "answers": [
                            {"text": "Federal income tax", "is_correct": True},
                            {"text": "Social Security tax", "is_correct": True},
                            {"text": "Luxury goods only tax", "is_correct": False},
                            {"text": "Medicare tax", "is_correct": True},
                        ],
                    },
                    {
                        "type": "mcq",
                        "prompt": "What does 'withholding' mean on your paycheck?",
                        "explanation": "Withholding is taxes taken out of each paycheck upfront. At tax time, you reconcile with what you actually owe.",
                        "order": 4,
                        "answers": [
                            {"text": "Your employer keeping extra wages", "is_correct": False},
                            {"text": "Taxes taken from your paycheck before you receive it", "is_correct": True},
                            {"text": "A savings account deduction", "is_correct": False},
                            {"text": "Your union dues", "is_correct": False},
                        ],
                    },
                    {
                        "type": "true_false",
                        "prompt": "Getting a large tax refund means you managed your taxes perfectly.",
                        "explanation": "False! A large refund means you overpaid the government interest-free. Ideally, you owe little or nothing.",
                        "order": 5,
                        "answers": [
                            {"text": "True", "is_correct": False},
                            {"text": "False", "is_correct": True},
                        ],
                    },
                ],
            },
            {
                "title": "Filing Your Return",
                "order": 2,
                "questions": [
                    {
                        "type": "mcq",
                        "prompt": "What is the standard tax filing deadline in the U.S.?",
                        "explanation": "Federal taxes are generally due April 15. Extensions can be requested but don't delay payment.",
                        "order": 1,
                        "answers": [
                            {"text": "January 1", "is_correct": False},
                            {"text": "April 15", "is_correct": True},
                            {"text": "June 30", "is_correct": False},
                            {"text": "December 31", "is_correct": False},
                        ],
                    },
                    {
                        "type": "true_false",
                        "prompt": "A W-2 form shows the income and taxes withheld by your employer.",
                        "explanation": "True! Your employer sends you a W-2 each year showing your total earnings and taxes withheld.",
                        "order": 2,
                        "answers": [
                            {"text": "True", "is_correct": True},
                            {"text": "False", "is_correct": False},
                        ],
                    },
                    {
                        "type": "select_all",
                        "prompt": "Which of these are common tax deductions?",
                        "explanation": "Mortgage interest, student loan interest, and charitable donations are all deductible if you itemize.",
                        "order": 3,
                        "answers": [
                            {"text": "Mortgage interest", "is_correct": True},
                            {"text": "Netflix subscription", "is_correct": False},
                            {"text": "Student loan interest", "is_correct": True},
                            {"text": "Charitable donations", "is_correct": True},
                        ],
                    },
                    {
                        "type": "mcq",
                        "prompt": "What is the difference between a tax deduction and a tax credit?",
                        "explanation": "Deductions reduce your taxable income. Credits directly reduce your tax bill dollar-for-dollar — more valuable.",
                        "order": 4,
                        "answers": [
                            {"text": "They are the same thing", "is_correct": False},
                            {"text": "Credits reduce taxable income; deductions reduce tax owed", "is_correct": False},
                            {"text": "Deductions reduce taxable income; credits reduce tax owed", "is_correct": True},
                            {"text": "Only deductions apply to individuals", "is_correct": False},
                        ],
                    },
                    {
                        "type": "true_false",
                        "prompt": "Free tax filing options are available for most Americans through the IRS.",
                        "explanation": "True! IRS Free File is available for those with income under $79,000, and VITA offers free in-person help.",
                        "order": 5,
                        "answers": [
                            {"text": "True", "is_correct": True},
                            {"text": "False", "is_correct": False},
                        ],
                    },
                ],
            },
            {
                "title": "Tax-Advantaged Accounts",
                "order": 3,
                "questions": [
                    {
                        "type": "mcq",
                        "prompt": "What is the main benefit of a Traditional 401(k)?",
                        "explanation": "Traditional 401(k) contributions are pre-tax, reducing your taxable income now. You pay tax when you withdraw.",
                        "order": 1,
                        "answers": [
                            {"text": "Withdrawals are always tax-free", "is_correct": False},
                            {"text": "Contributions reduce your taxable income now", "is_correct": True},
                            {"text": "There's no contribution limit", "is_correct": False},
                            {"text": "Guaranteed investment returns", "is_correct": False},
                        ],
                    },
                    {
                        "type": "true_false",
                        "prompt": "A Roth IRA is funded with after-tax dollars, and qualified withdrawals are tax-free.",
                        "explanation": "True! You pay tax now, but all growth and qualified withdrawals in retirement are completely tax-free.",
                        "order": 2,
                        "answers": [
                            {"text": "True", "is_correct": True},
                            {"text": "False", "is_correct": False},
                        ],
                    },
                    {
                        "type": "select_all",
                        "prompt": "Which accounts offer tax advantages for saving?",
                        "explanation": "401(k), IRA, Roth IRA, and HSA are all tax-advantaged accounts the government created to encourage saving.",
                        "order": 3,
                        "answers": [
                            {"text": "401(k)", "is_correct": True},
                            {"text": "Regular checking account", "is_correct": False},
                            {"text": "Roth IRA", "is_correct": True},
                            {"text": "Health Savings Account (HSA)", "is_correct": True},
                        ],
                    },
                    {
                        "type": "mcq",
                        "prompt": "What happens if you withdraw from a Traditional IRA before age 59½?",
                        "explanation": "Early withdrawals incur a 10% penalty PLUS ordinary income taxes on the amount withdrawn.",
                        "order": 4,
                        "answers": [
                            {"text": "Nothing, you can withdraw anytime", "is_correct": False},
                            {"text": "You get a government bonus", "is_correct": False},
                            {"text": "10% penalty plus income taxes", "is_correct": True},
                            {"text": "You lose the account permanently", "is_correct": False},
                        ],
                    },
                    {
                        "type": "true_false",
                        "prompt": "Employer 401(k) matching is essentially free money you should always take advantage of.",
                        "explanation": "True! Employer matching is an immediate 50–100% return on your contribution. Never leave it on the table.",
                        "order": 5,
                        "answers": [
                            {"text": "True", "is_correct": True},
                            {"text": "False", "is_correct": False},
                        ],
                    },
                ],
            },
        ],
    },
    {
        "title": "Insurance Fundamentals",
        "description": "Protect yourself and your finances with the right insurance coverage.",
        "icon": "🛡️",
        "order": 5,
        "lessons": [
            {
                "title": "Why Insurance Matters",
                "order": 1,
                "questions": [
                    {
                        "type": "mcq",
                        "prompt": "What is the primary purpose of insurance?",
                        "explanation": "Insurance transfers financial risk from you to an insurance company in exchange for premium payments.",
                        "order": 1,
                        "answers": [
                            {"text": "To make insurance companies rich", "is_correct": False},
                            {"text": "To transfer financial risk to an insurer", "is_correct": True},
                            {"text": "To guarantee you'll never have accidents", "is_correct": False},
                            {"text": "To replace your savings account", "is_correct": False},
                        ],
                    },
                    {
                        "type": "true_false",
                        "prompt": "Young and healthy people don't need health insurance.",
                        "explanation": "False! Accidents and unexpected illnesses can happen at any age. Medical bills are a leading cause of bankruptcy.",
                        "order": 2,
                        "answers": [
                            {"text": "True", "is_correct": False},
                            {"text": "False", "is_correct": True},
                        ],
                    },
                    {
                        "type": "select_all",
                        "prompt": "Which of these is insurance designed to protect against?",
                        "explanation": "Insurance protects against large, unpredictable financial losses — medical bills, accidents, property damage, death.",
                        "order": 3,
                        "answers": [
                            {"text": "Large unexpected medical bills", "is_correct": True},
                            {"text": "Day-to-day grocery expenses", "is_correct": False},
                            {"text": "Car accident costs", "is_correct": True},
                            {"text": "Loss of income if you can't work", "is_correct": True},
                        ],
                    },
                    {
                        "type": "mcq",
                        "prompt": "What is a 'premium' in insurance?",
                        "explanation": "A premium is the regular payment (monthly or annual) you make to maintain your insurance coverage.",
                        "order": 4,
                        "answers": [
                            {"text": "The money you get paid after a claim", "is_correct": False},
                            {"text": "A discount for being a good driver", "is_correct": False},
                            {"text": "The regular payment to maintain coverage", "is_correct": True},
                            {"text": "The maximum amount an insurer will pay", "is_correct": False},
                        ],
                    },
                    {
                        "type": "true_false",
                        "prompt": "Having a higher deductible usually means paying a lower monthly premium.",
                        "explanation": "True! You take on more risk (higher deductible), so the insurer charges you less each month.",
                        "order": 5,
                        "answers": [
                            {"text": "True", "is_correct": True},
                            {"text": "False", "is_correct": False},
                        ],
                    },
                ],
            },
            {
                "title": "Types of Insurance",
                "order": 2,
                "questions": [
                    {
                        "type": "select_all",
                        "prompt": "Which of these are types of insurance most adults should consider?",
                        "explanation": "Health, auto, renters/homeowners, and life insurance are the four core types most adults need.",
                        "order": 1,
                        "answers": [
                            {"text": "Health insurance", "is_correct": True},
                            {"text": "Auto insurance", "is_correct": True},
                            {"text": "Lottery insurance", "is_correct": False},
                            {"text": "Renters or homeowners insurance", "is_correct": True},
                        ],
                    },
                    {
                        "type": "mcq",
                        "prompt": "What does 'liability coverage' in car insurance protect?",
                        "explanation": "Liability covers damage you cause to other people and their property — it does NOT cover your own car.",
                        "order": 2,
                        "answers": [
                            {"text": "Damage to your own car", "is_correct": False},
                            {"text": "Damage you cause to others and their property", "is_correct": True},
                            {"text": "Medical bills for you and your passengers", "is_correct": False},
                            {"text": "Theft of your vehicle", "is_correct": False},
                        ],
                    },
                    {
                        "type": "true_false",
                        "prompt": "Renters insurance covers your personal belongings if they're stolen.",
                        "explanation": "True! Renters insurance covers your possessions against theft, fire, and other covered perils.",
                        "order": 3,
                        "answers": [
                            {"text": "True", "is_correct": True},
                            {"text": "False", "is_correct": False},
                        ],
                    },
                    {
                        "type": "mcq",
                        "prompt": "Who most needs life insurance?",
                        "explanation": "Life insurance is most important for people with dependents (children, spouse) who rely on their income.",
                        "order": 4,
                        "answers": [
                            {"text": "Single people with no dependents", "is_correct": False},
                            {"text": "People with dependents who rely on their income", "is_correct": True},
                            {"text": "Only people over age 65", "is_correct": False},
                            {"text": "Only business owners", "is_correct": False},
                        ],
                    },
                    {
                        "type": "true_false",
                        "prompt": "Disability insurance replaces a portion of your income if you're too sick or injured to work.",
                        "explanation": "True! Disability insurance protects your income — your most valuable financial asset.",
                        "order": 5,
                        "answers": [
                            {"text": "True", "is_correct": True},
                            {"text": "False", "is_correct": False},
                        ],
                    },
                ],
            },
            {
                "title": "Choosing a Policy",
                "order": 3,
                "questions": [
                    {
                        "type": "mcq",
                        "prompt": "What is a 'deductible' in insurance?",
                        "explanation": "A deductible is the amount YOU pay out-of-pocket before insurance kicks in to cover the rest.",
                        "order": 1,
                        "answers": [
                            {"text": "The monthly fee for insurance", "is_correct": False},
                            {"text": "The total maximum coverage amount", "is_correct": False},
                            {"text": "The amount you pay before insurance covers the rest", "is_correct": True},
                            {"text": "A discount on your premium", "is_correct": False},
                        ],
                    },
                    {
                        "type": "true_false",
                        "prompt": "You should compare multiple insurance quotes before choosing a policy.",
                        "explanation": "True! Prices vary significantly between insurers. Shopping around can save hundreds per year.",
                        "order": 2,
                        "answers": [
                            {"text": "True", "is_correct": True},
                            {"text": "False", "is_correct": False},
                        ],
                    },
                    {
                        "type": "select_all",
                        "prompt": "What factors should you consider when choosing an insurance policy?",
                        "explanation": "Premium cost, deductible, coverage limits, and company reputation all matter when selecting a policy.",
                        "order": 3,
                        "answers": [
                            {"text": "Monthly premium cost", "is_correct": True},
                            {"text": "Deductible amount", "is_correct": True},
                            {"text": "The insurer's financial stability rating", "is_correct": True},
                            {"text": "The color of the insurance card", "is_correct": False},
                        ],
                    },
                    {
                        "type": "mcq",
                        "prompt": "What is an 'out-of-pocket maximum' in health insurance?",
                        "explanation": "The out-of-pocket maximum is the most you'll ever pay in a year. After that, insurance covers 100%.",
                        "order": 4,
                        "answers": [
                            {"text": "The maximum premium you can be charged", "is_correct": False},
                            {"text": "The most you'll pay in a year before insurance covers everything", "is_correct": True},
                            {"text": "The amount your employer contributes", "is_correct": False},
                            {"text": "The annual deductible", "is_correct": False},
                        ],
                    },
                    {
                        "type": "true_false",
                        "prompt": "Bundling multiple insurance policies (like home and auto) with one company often leads to discounts.",
                        "explanation": "True! Most insurers offer multi-policy discounts, often saving 10–25% on premiums.",
                        "order": 5,
                        "answers": [
                            {"text": "True", "is_correct": True},
                            {"text": "False", "is_correct": False},
                        ],
                    },
                ],
            },
        ],
    },
]


class Command(BaseCommand):
    help = 'Seed the database with financial literacy course content'

    def handle(self, *args, **options):
        self.stdout.write('Clearing existing course data...')
        Module.objects.all().delete()

        self.stdout.write('Seeding courses...')
        for module_data in COURSE_DATA:
            module = Module.objects.create(
                title=module_data['title'],
                description=module_data['description'],
                icon=module_data['icon'],
                order=module_data['order'],
            )
            for lesson_data in module_data['lessons']:
                lesson = Lesson.objects.create(
                    module=module,
                    title=lesson_data['title'],
                    order=lesson_data['order'],
                )
                for q_data in lesson_data['questions']:
                    question = Question.objects.create(
                        lesson=lesson,
                        question_type=q_data['type'],
                        prompt=q_data['prompt'],
                        explanation=q_data['explanation'],
                        order=q_data['order'],
                    )
                    for a_data in q_data['answers']:
                        Answer.objects.create(
                            question=question,
                            text=a_data['text'],
                            is_correct=a_data['is_correct'],
                        )

        module_count = Module.objects.count()
        lesson_count = Lesson.objects.count()
        question_count = Question.objects.count()
        self.stdout.write(
            self.style.SUCCESS(
                f'Done! Created {module_count} modules, {lesson_count} lessons, {question_count} questions.'
            )
        )
