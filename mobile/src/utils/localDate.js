/**
 * The device's current calendar date (YYYY-MM-DD) in the phone's local time
 * zone. Sent to the backend as `client_date` so daily streaks/rewards reset at
 * the user's local midnight rather than at midnight UTC.
 */

export function localDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Seconds remaining until the next local midnight on the device. Computed on
 * the device so the "next puzzle" countdown always reflects the user's own time
 * zone rather than the server's.
 */
export function secondsUntilLocalMidnight() {
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  return Math.max(0, Math.round((nextMidnight - now) / 1000));
}
