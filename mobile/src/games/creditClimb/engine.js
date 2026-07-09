export const ROUND_SECONDS = 60;
export const CREDIT_LIMIT = 1000;
export const SAFE_THRESHOLD = 0.30; // keep utilization under 30%
export const PAYMENT_AMOUNT = 70;
export const CHARGE_MIN = 30;
export const CHARGE_MAX = 95;
export const SAFE_TICK_POINTS = 10;

// Charges hit faster as the round goes on.
export const CHARGE_START_MS = 1150;
export const CHARGE_MIN_MS = 520;

const CHARGE_LABELS = [
  'Coffee', 'Groceries', 'Gas', 'Online order', 'Dinner out',
  'Subscription', 'Rideshare', 'Impulse buy', 'Late fee', 'Gadget',
];

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export function makeCharge() {
  return {
    amount: Math.round(randomBetween(CHARGE_MIN, CHARGE_MAX)),
    label: CHARGE_LABELS[Math.floor(Math.random() * CHARGE_LABELS.length)],
  };
}

export function utilization(balance) {
  return Math.min(1, balance / CREDIT_LIMIT);
}

export function isSafe(balance) {
  return utilization(balance) <= SAFE_THRESHOLD;
}

export function applyCharge(balance, amount) {
  return Math.min(CREDIT_LIMIT, balance + amount);
}

export function applyPayment(balance) {
  return Math.max(0, balance - PAYMENT_AMOUNT);
}

export function chargeIntervalForElapsed(elapsedSeconds) {
  const progress = Math.min(1, elapsedSeconds / ROUND_SECONDS);
  return CHARGE_START_MS - (CHARGE_START_MS - CHARGE_MIN_MS) * progress;
}
