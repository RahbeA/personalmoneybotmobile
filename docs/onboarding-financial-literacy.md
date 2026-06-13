# Onboarding: Financial Literacy Assessment & Gamified Ranking

## Purpose

When a new user creates an account, we run a short, interactive assessment to
measure their **baseline financial literacy**. The goal is to:

1. Figure out where each user is starting from (so we can personalize later).
2. Turn that baseline into a **gamified rank** the user can see and feel good about.
3. Give them a clear way to **level the rank up** by completing lessons, streaks,
   and tasks.

It is deliberately framed as a quick, low-pressure "What's your Money IQ?" game —
not a graded test. Users tap answers on animated cards, there's no right/wrong
feedback mid-quiz, and the flow ends with a celebratory rank reveal.

---

## What's asked (the questions)

The assessment is **5 questions**. They are not arbitrary — they are the
standard questions used by economists to measure financial literacy.

### Questions 1–3: The "Big Three" (Lusardi & Mitchell)

These three questions are *the* canonical measure of financial literacy in
academic research. They test the three core concepts that underpin almost every
financial decision: **compounding, inflation, and risk diversification**.

**Q1 — Compound interest**
> "You drop $100 into a savings account earning 2% a year and never touch it
> again. How much is in there after 5 years?"
>
> - **More than $102** ✅ (correct)
> - Exactly $102
> - Less than $102
> - Not sure
>
> *Tests whether the user understands that interest compounds over time.*

**Q2 — Inflation**
> "Your account earns 1% a year, but prices (inflation) go up 2% a year. After 1
> year, how much could you actually buy with that money?"
>
> - More than today
> - Exactly the same
> - **Less than today** ✅ (correct)
> - Not sure
>
> *Tests whether the user understands that inflation erodes real purchasing power.*

**Q3 — Risk & diversification**
> "True or false: buying a single company's stock usually gives you a safer
> return than buying a whole stock mutual fund."
>
> - True
> - **False** ✅ (correct)
> - Not sure
>
> *Tests whether the user understands that diversification reduces risk.*

### Questions 4–5: The "Big Five" extension (FINRA NFCS)

The FINRA Investor Education Foundation's **National Financial Capability Study
(NFCS)** extends the Big Three with two more questions on bonds and mortgages.
We include them to get finer-grained resolution on the user's starting level.

**Q4 — Bonds**
> "When interest rates go up, what usually happens to bond prices?"
>
> - They go up too
> - **They go down** ✅ (correct)
> - They stay the same
> - Not sure
>
> *Tests understanding of the inverse relationship between rates and bond prices.*

**Q5 — Loans & mortgages**
> "True or false: a 15-year mortgage has higher monthly payments than a 30-year
> one, but you pay less total interest overall."
>
> - **True** ✅ (correct)
> - False
> - Not sure
>
> *Tests understanding of how loan term affects monthly payment vs. total interest.*

> **Note:** We keep the substance faithful to the published research wording but
> phrase it more casually for a friendly onboarding tone. The correct answers
> live only on the server (`backend/courses/onboarding.py`) so the client can't
> see or scrape them.

---

## Why this is grounded in research

| Question | Concept | Source |
|----------|---------|--------|
| Q1 Compound interest | Numeracy / compounding | Lusardi & Mitchell — "Big Three" |
| Q2 Inflation | Real vs. nominal value | Lusardi & Mitchell — "Big Three" |
| Q3 Diversification | Risk | Lusardi & Mitchell — "Big Three" |
| Q4 Bond pricing | Interest-rate risk | FINRA NFCS — "Big Five" |
| Q5 Mortgage interest | Debt / loan structure | FINRA NFCS — "Big Five" |

The **Big Three** were introduced by Annamaria Lusardi and Olivia S. Mitchell and
are the most widely used and validated instrument for measuring financial
literacy across the world. They have been fielded in dozens of countries and are
predictive of real outcomes like retirement planning, debt management, and wealth
accumulation.

The **Big Five** is the extended set used by the FINRA Investor Education
Foundation's National Financial Capability Study in the United States, adding the
bond and mortgage questions.

### References

- Lusardi, A., & Mitchell, O. S. (2011). *Financial Literacy around the World: An
  Overview.* Journal of Pension Economics & Finance, 10(4), 497–508.
- Lusardi, A., & Mitchell, O. S. (2014). *The Economic Importance of Financial
  Literacy: Theory and Evidence.* Journal of Economic Literature, 52(1), 5–44.
- FINRA Investor Education Foundation. *National Financial Capability Study
  (NFCS).* https://www.finrafoundation.org/

---

## Scoring & ranking

### Score

The raw score is simply the **number of correct answers (0–5)**. This is stored
on the user's stats as `onboarding_score`.

### Literacy points

We convert the assessment into a composite **literacy points** total that also
grows as the user earns XP:

```
literacy_points = (onboarding_score × 100) + lifetime_xp
```

Because lifetime XP feeds the same number, **every lesson, streak, and task the
user completes raises their literacy points — and therefore their rank.** The
onboarding score is just the head start.

### Rank tiers

| Tier | Rank name | Points required |
|------|-----------|-----------------|
| 1 | 🥉 Money Rookie | 0 |
| 2 | 🥈 Money Apprentice | 150 |
| 3 | 🥇 Money Strategist | 400 |
| 4 | 💎 Money Master | 750 |
| 5 | ✨ Wealth Wizard | 1,300 |

**Example outcomes:**

- 0 correct → 0 pts → **Money Rookie** (climbs by doing lessons)
- 3 correct → 300 pts → **Money Apprentice** (100 pts from next tier)
- 5 correct → 500 pts → **Money Strategist** (a knowledgeable user starts higher)

The rank is computed centrally on the server so it's always the single source of
truth, and it's returned in the stats payload as a `rank` object:

```json
{
  "key": "silver",
  "label": "Money Apprentice",
  "tier": 2,
  "max_tier": 5,
  "points": 300,
  "next_label": "Money Strategist",
  "points_to_next": 100,
  "progress": 0.6
}
```

---

## Where it lives in the code

### Backend (`backend/`)

| File | Responsibility |
|------|----------------|
| `courses/onboarding.py` | Question bank, correct answers, scoring, rank tiers |
| `courses/models.py` | `UserStats.onboarding_completed / onboarding_score / onboarding_answers` |
| `courses/serializers.py` | Exposes `onboarding_completed`, `onboarding_score`, computed `rank` |
| `courses/views.py` | `onboarding_questions` (GET) and `onboarding_submit` (POST) |
| `courses/urls.py` | Routes: `/api/courses/onboarding/questions/` and `.../submit/` |

### Mobile (`mobile/src/`)

| File | Responsibility |
|------|----------------|
| `screens/OnboardingScreen.js` | The interactive flow: intro → questions → calc → rank reveal |
| `context/UserProgressContext.js` | `onboardingCompleted`, `rank`, `submitOnboarding`, `finishOnboarding`, `getRankMeta` |
| `api/courses.js` | `getOnboardingQuestions`, `submitOnboarding` |
| `App.js` | **Navigation gate** — signed-in users with `onboardingCompleted === false` see `OnboardingScreen` before `Main` |
| `screens/HomeScreen.js`, `screens/SettingsScreen.js` | Display the rank badge |

### How the gate works

In `App.js`, once a user is signed in we wait for the first stats fetch, then:

- `onboardingCompleted === false` → render the `Onboarding` screen.
- `onboardingCompleted === true` → render the main app (`Main`).

On submit, the screen stores the result and shows the rank reveal, then flips the
gate (`finishOnboarding`) so the navigator swaps to the main app. The backend
persists `onboarding_completed = true`, so the assessment only ever shows once
per account (across devices and reinstalls).

> **Important for maintainers:** any rewrite of `App.js` (e.g. adding a new auth
> provider) must preserve this gate. If a signed-in user goes straight to `Main`,
> onboarding is being skipped.
