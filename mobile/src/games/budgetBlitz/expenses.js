export const BUCKETS = {
  needs: { label: 'Needs', color: '#3B9EE3', icon: 'home' },
  wants: { label: 'Wants', color: '#FB8C3C', icon: 'sparkles' },
  savings: { label: 'Savings', color: '#42CF5A', icon: 'trending-up' },
};

export const EXPENSES = [
  { label: 'Rent', emoji: '🏠', bucket: 'needs' },
  { label: 'Groceries', emoji: '🛒', bucket: 'needs' },
  { label: 'Electric bill', emoji: '💡', bucket: 'needs' },
  { label: 'Health insurance', emoji: '🏥', bucket: 'needs' },
  { label: 'Gas for car', emoji: '⛽', bucket: 'needs' },
  { label: 'Phone bill', emoji: '📱', bucket: 'needs' },
  { label: 'Minimum loan payment', emoji: '🏦', bucket: 'needs' },
  { label: 'Netflix', emoji: '📺', bucket: 'wants' },
  { label: 'Coffee shop', emoji: '☕', bucket: 'wants' },
  { label: 'Concert tickets', emoji: '🎵', bucket: 'wants' },
  { label: 'New sneakers', emoji: '👟', bucket: 'wants' },
  { label: 'Video game', emoji: '🎮', bucket: 'wants' },
  { label: 'Restaurant dinner', emoji: '🍽️', bucket: 'wants' },
  { label: 'Streaming subscription', emoji: '🎬', bucket: 'wants' },
  { label: 'Emergency fund', emoji: '🛡️', bucket: 'savings' },
  { label: '401k contribution', emoji: '📈', bucket: 'savings' },
  { label: 'High-yield savings', emoji: '💰', bucket: 'savings' },
  { label: 'Investment account', emoji: '📊', bucket: 'savings' },
  { label: 'College fund', emoji: '🎓', bucket: 'savings' },
  { label: 'Debt extra payment', emoji: '💳', bucket: 'savings' },
];

export const ROUND_SECONDS = 60;
export const BASE_POINTS = 10;
export const COMBO_BONUS = 5;
export const WRONG_PENALTY = 5;
