import * as SecureStore from 'expo-secure-store';
import { getCacheScope } from './apiCache';

function storageKey(userId) {
  return `onboardingCompleted:${getCacheScope()}:${userId}`;
}

/** True when stats (API or cache) show the user already finished the Money IQ quiz. */
export function inferOnboardingCompleted(stats) {
  if (!stats) return false;
  return !!(
    stats.onboarding_completed
    || stats.rank
    || (typeof stats.onboarding_score === 'number' && stats.onboarding_score > 0)
  );
}

export async function readOnboardingCompleted(userId) {
  if (!userId) return false;
  try {
    return (await SecureStore.getItemAsync(storageKey(userId))) === 'true';
  } catch {
    return false;
  }
}

export async function persistOnboardingCompleted(userId, completed) {
  if (!userId) return;
  try {
    if (completed) {
      await SecureStore.setItemAsync(storageKey(userId), 'true');
    } else {
      await SecureStore.deleteItemAsync(storageKey(userId));
    }
  } catch {
    // SecureStore may be unavailable in some dev setups.
  }
}
