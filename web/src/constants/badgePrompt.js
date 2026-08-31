/** Copy into your AI image tool when generating badge icons for MoneyBot. */
export const BADGE_ICON_AI_PROMPT = `Generate a single badge icon for the MoneyBot financial literacy mobile app.

REQUIREMENTS (strict):
- Output: PNG, 256×256 pixels, square canvas
- Background: fully transparent (no fill, no gradient backdrop)
- Style: flat vector or soft 3D emblem — bold shapes readable at 44px display size
- Content: ONE centered symbol/emblem only — NO text, NO letters, NO numbers
- Safe zone: keep artwork inside inner 80% (≈20px padding on all sides)
- Colors: primary accent {ACCENT_COLOR}; optional 1–2 complementary hues max
- Mood: positive, achievement, kid-friendly but not childish

BADGE CONTEXT:
- Name: {BADGE_NAME}
- Description: {BADGE_DESCRIPTION}
- Metric: {BADGE_METRIC} (threshold {THRESHOLD})

Deliver a crisp icon suitable for a circular 56px badge chip in a React Native app.`;

export function fillBadgePrompt({ name, description, metric, threshold, accentColor }) {
  return BADGE_ICON_AI_PROMPT
    .replace('{ACCENT_COLOR}', accentColor || '#3DDC5F')
    .replace('{BADGE_NAME}', name || 'Badge')
    .replace('{BADGE_DESCRIPTION}', description || '')
    .replace('{BADGE_METRIC}', metric || '')
    .replace('{THRESHOLD}', String(threshold ?? 1));
}

export const BADGE_METRICS = [
  { value: 'lessons_completed', label: 'Lessons completed' },
  { value: 'modules_completed', label: 'Modules completed (any)' },
  { value: 'module_completed', label: 'Specific module completed' },
  { value: 'streak_days', label: 'Lesson activity streak (days)' },
  { value: 'daily_claim_streak', label: 'Daily reward claim streak' },
  { value: 'daily_reward_day', label: 'Daily reward tier reached (1–7)' },
  { value: 'bot_bucks', label: 'Bot Bucks balance' },
  { value: 'xp', label: 'Total XP' },
  { value: 'onboarding_score', label: 'Onboarding score' },
  { value: 'characters_owned', label: 'Characters owned' },
  { value: 'friends_count', label: 'Accepted friends' },
  { value: 'questions_correct', label: 'Questions answered correctly' },
  { value: 'perfect_lessons', label: 'Perfect lessons (0 mistakes)' },
];

export const ION_ICON_OPTIONS = [
  'flag', 'flame', 'flash', 'school', 'wallet', 'trending-up', 'card', 'receipt',
  'shield-checkmark', 'ribbon', 'trophy', 'medal', 'star', 'diamond', 'planet',
];
