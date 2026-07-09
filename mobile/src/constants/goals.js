// Financial goals the user can pick during onboarding and edit later in
// Settings. Keys are persisted to the backend (UserStats.onboarding_goals).
// Icons use Ionicons so they always render.
export const GOALS = [
  { key: 'emergency_fund', label: 'Emergency fund', icon: 'shield-checkmark' },
  { key: 'pay_off_debt', label: 'Crush debt', icon: 'card' },
  { key: 'start_investing', label: 'Start investing', icon: 'trending-up' },
  { key: 'budget_better', label: 'Budget better', icon: 'pie-chart' },
  { key: 'boost_credit', label: 'Boost my credit', icon: 'star' },
  { key: 'save_big_goal', label: 'Save for a goal', icon: 'flag' },
];

export const GOAL_BY_KEY = GOALS.reduce((acc, g) => {
  acc[g.key] = g;
  return acc;
}, {});
