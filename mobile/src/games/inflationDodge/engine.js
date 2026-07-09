export const ROUND_SECONDS = 60;
export const COIN_SIZE = 64;
export const COIN_LIFETIME_MS = 3200;
export const MIN_VALUE = 15;
export const MAX_VALUE = 45;

// Coins spawn faster as the round progresses to ramp up difficulty.
export const SPAWN_START_MS = 950;
export const SPAWN_MIN_MS = 480;

let counter = 0;

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export function nextCoinId() {
  counter += 1;
  return `coin-${counter}`;
}

export function makeCoin(areaWidth, areaHeight) {
  const value = Math.round(randomBetween(MIN_VALUE, MAX_VALUE));
  const maxX = Math.max(0, areaWidth - COIN_SIZE);
  const maxY = Math.max(0, areaHeight - COIN_SIZE);
  return {
    id: nextCoinId(),
    value,
    x: randomBetween(0, maxX),
    y: randomBetween(0, maxY),
    spawnAt: Date.now(),
    lifetime: COIN_LIFETIME_MS,
  };
}

// Real value erodes the longer a coin sits on screen (inflation). Tap early to
// keep full purchasing power; wait and the collected value shrinks.
export function remainingFraction(coin, now = Date.now()) {
  const elapsed = now - coin.spawnAt;
  return Math.max(0, Math.min(1, 1 - elapsed / coin.lifetime));
}

export function collectedValue(coin, now = Date.now()) {
  const fraction = remainingFraction(coin, now);
  return Math.max(1, Math.round(coin.value * fraction));
}

// Spawn interval tightens linearly across the round.
export function spawnIntervalForElapsed(elapsedSeconds) {
  const progress = Math.min(1, elapsedSeconds / ROUND_SECONDS);
  return SPAWN_START_MS - (SPAWN_START_MS - SPAWN_MIN_MS) * progress;
}
