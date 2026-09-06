import * as SecureStore from 'expo-secure-store';
import { getCacheScope } from './apiCache';

/**
 * Tiny persistence for "has the user seen this one-time tutorial?" flags.
 * Keyed by cache scope + user so it resets per account / environment.
 * `userId` may be a real id or a string like 'guest'.
 *
 * IMPORTANT: expo-secure-store keys may only contain alphanumerics and
 * `.`, `-`, `_`. Colons (or other punctuation) make setItem/getItem throw,
 * which silently breaks persistence — so we sanitize every segment.
 */
function storageKey(tutorialKey, userId) {
  const raw = `tutorialSeen_${getCacheScope()}_${tutorialKey}_${userId}`;
  return raw.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function readTutorialSeen(tutorialKey, userId) {
  if (!userId) return true; // no identity yet — don't flash the tutorial
  try {
    return (await SecureStore.getItemAsync(storageKey(tutorialKey, userId))) === 'true';
  } catch {
    return false;
  }
}

export async function persistTutorialSeen(tutorialKey, userId) {
  if (!userId) return;
  try {
    await SecureStore.setItemAsync(storageKey(tutorialKey, userId), 'true');
  } catch {
    // SecureStore may be unavailable in some dev setups — fail open.
  }
}
