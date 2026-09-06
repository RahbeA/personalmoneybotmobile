import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { API_BASE_URL } from '../config/api';

/**
 * Compare two dotted numeric version strings ("1.2.10" vs "1.3.0").
 * Returns 1 if a > b, -1 if a < b, 0 if equal. Missing/invalid parts count as 0.
 */
export function compareVersions(a, b) {
  const pa = String(a || '').split('.');
  const pb = String(b || '').split('.');
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const x = parseInt(pa[i], 10) || 0;
    const y = parseInt(pb[i], 10) || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

/** The native build's marketing version (e.g. "1.0.6"), or null if unavailable. */
export function getCurrentAppVersion() {
  return Application.nativeApplicationVersion || null;
}

/**
 * Ask the backend whether the installed app is too old to keep running.
 * Fails OPEN: any network/parse error (or missing config) returns null so a
 * flaky connection can never lock a user out.
 *
 * @returns {Promise<null | { current, min, latest, storeUrl }>}
 */
export async function checkForceUpdate() {
  try {
    const res = await fetch(`${API_BASE_URL}/app-version/`);
    if (!res.ok) return null;
    const data = await res.json();

    const min = data?.min_supported_version;
    const current = getCurrentAppVersion();
    // No minimum configured, or we can't read our own version → don't gate.
    if (!min || !current) return null;
    if (compareVersions(current, min) >= 0) return null;

    const storeUrl = Platform.OS === 'android' ? data?.android_url : data?.ios_url;
    return {
      current,
      min,
      latest: data?.latest_version || min,
      storeUrl: storeUrl || null,
    };
  } catch {
    return null;
  }
}
