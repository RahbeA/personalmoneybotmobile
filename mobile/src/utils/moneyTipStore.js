import * as SecureStore from 'expo-secure-store';
import { getCacheScope } from './apiCache';

/**
 * Tracks the last local date the daily Money Tip was shown, so it auto-pops
 * at most once per calendar day (per account). Users can still open it any
 * time from the Home app bar button.
 *
 * NOTE: expo-secure-store keys may only contain alphanumerics and
 * `.`, `-`, `_`, so we sanitize the key (colons silently break it).
 */
function storageKey(userId) {
  const raw = `moneyTipShownDate_${getCacheScope()}_${userId}`;
  return raw.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/** Local calendar date as YYYY-MM-DD (device timezone). */
export function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function readTipSeenToday(userId) {
  if (!userId) return false;
  try {
    const stored = await SecureStore.getItemAsync(storageKey(userId));
    return stored === localDateKey();
  } catch {
    return false;
  }
}

export async function persistTipSeenToday(userId) {
  if (!userId) return;
  try {
    await SecureStore.setItemAsync(storageKey(userId), localDateKey());
  } catch {
    // SecureStore may be unavailable in some dev setups — fail open.
  }
}
