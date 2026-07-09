import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';

const STORAGE_PREFIX = '@moneybot:cache:';
const SCOPE_STORAGE_KEY = '@moneybot:cache:scope';

export const isApiCacheDebugEnabled =
  __DEV__ || process.env.EXPO_PUBLIC_MODEL_CACHE_DEBUG === '1'
  || process.env.EXPO_PUBLIC_CACHE_DEBUG === '1';

export const TTL = {
  PROGRESS_FRESH_MS: 2 * 60 * 1000,
  PROGRESS_STALE_MS: 24 * 60 * 60 * 1000,
  LESSON_QUESTIONS_MS: 30 * 24 * 60 * 60 * 1000,
  ONBOARDING_MS: 7 * 24 * 60 * 60 * 1000,
  LEADERBOARD_MS: 45 * 1000,
  CHARACTERS_FRESH_MS: 5 * 60 * 1000,
  CHARACTERS_STALE_MS: 24 * 60 * 60 * 1000,
  TUTOR_CONVERSATIONS_MS: 60 * 1000,
};

const memory = new Map();
const stats = {
  memoryHit: 0,
  storageHit: 0,
  miss: 0,
  write: 0,
};

let scopeEnsured = false;
let scopePromise = null;

/** Stable scope so localhost and production caches never share keys. */
export function getCacheScope() {
  try {
    const url = new URL(API_BASE_URL);
    const host = url.hostname.replace(/\./g, '_');
    const port = url.port ? `_${url.port}` : '';
    return `${host}${port}`;
  } catch {
    return API_BASE_URL.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 64);
  }
}

function scopedKey(key) {
  return `${getCacheScope()}:${key}`;
}

function log(category, source, message) {
  if (!isApiCacheDebugEnabled) return;
  // eslint-disable-next-line no-console
  console.log(`[ApiCache] ${category} ← ${source} | ${message}`);
}

function diskKey(key) {
  return `${STORAGE_PREFIX}${scopedKey(key)}`;
}

export const cacheKeys = {
  progress: (userId) => `progress:${userId}`,
  lessonQuestions: (lessonId) => `lesson:${lessonId}:questions`,
  onboardingQuestions: () => 'onboarding:questions:v2',
  leaderboardPage1: () => 'leaderboard:page1',
  leaderboardSearch: (q) => `leaderboard:search:${q.toLowerCase().trim()}`,
  characters: (userId) => `characters:${userId}`,
  tutorConversations: (userId) => `tutor:conversations:${userId}`,
};

export function getCacheStats() {
  return { ...stats };
}

/**
 * Wipe stale cache when switching API environments (e.g. localhost → production).
 * Call once at app boot before UserProgressProvider hydrates.
 */
export async function ensureCacheScope() {
  if (scopeEnsured) return;
  if (scopePromise) return scopePromise;

  scopePromise = (async () => {
    const scope = getCacheScope();
    try {
      const last = await AsyncStorage.getItem(SCOPE_STORAGE_KEY);
      if (last && last !== scope) {
        log('SCOPE', 'changed', `${last} → ${scope}`);
        await clearAllApiCache();
      }
      await AsyncStorage.setItem(SCOPE_STORAGE_KEY, scope);
    } catch {
      // ignore storage errors
    }
    scopeEnsured = true;
  })();

  return scopePromise;
}

export async function readCache(key, { freshMs, staleMs = freshMs } = {}) {
  const scoped = scopedKey(key);
  const now = Date.now();
  const mem = memory.get(scoped);
  if (mem && now - mem.at <= freshMs) {
    stats.memoryHit += 1;
    log('READ', 'memory', key);
    return { data: mem.data, source: 'memory', stale: false };
  }

  try {
    const raw = await AsyncStorage.getItem(diskKey(key));
    if (raw) {
      const entry = JSON.parse(raw);
      const age = now - entry.at;
      if (age <= staleMs) {
        memory.set(scoped, { data: entry.data, at: entry.at });
        const stale = age > freshMs;
        stats.storageHit += 1;
        log('READ', stale ? 'storage-stale' : 'storage', key);
        return { data: entry.data, source: stale ? 'storage-stale' : 'storage', stale };
      }
    }
  } catch {
    // ignore corrupt storage
  }

  stats.miss += 1;
  log('READ', 'miss', key);
  return { data: null, source: 'miss', stale: false };
}

export async function writeCache(key, data) {
  const scoped = scopedKey(key);
  const at = Date.now();
  memory.set(scoped, { data, at });
  stats.write += 1;
  log('WRITE', 'memory+disk', key);
  try {
    await AsyncStorage.setItem(diskKey(key), JSON.stringify({ data, at }));
  } catch {
    // disk full etc.
  }
}

export async function invalidateCache(key) {
  const scoped = scopedKey(key);
  memory.delete(scoped);
  try {
    await AsyncStorage.removeItem(diskKey(key));
  } catch {
    // ignore
  }
  log('INVALIDATE', 'memory+disk', key);
}

export async function invalidateCachePrefix(prefix) {
  const scopePrefix = `${getCacheScope()}:${prefix}`;
  const toDelete = [];
  for (const key of memory.keys()) {
    if (key.startsWith(scopePrefix)) {
      memory.delete(key);
      toDelete.push(`${STORAGE_PREFIX}${key}`);
    }
  }
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const scopedDiskPrefix = `${STORAGE_PREFIX}${scopePrefix}`;
    const matching = allKeys.filter((k) => k.startsWith(scopedDiskPrefix));
    toDelete.push(...matching);
    if (toDelete.length) await AsyncStorage.multiRemove([...new Set(toDelete)]);
  } catch {
    // ignore
  }
  log('INVALIDATE', 'prefix', prefix);
}

export async function clearAllApiCache() {
  memory.clear();
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const ours = allKeys.filter((k) => k.startsWith(STORAGE_PREFIX) && k !== SCOPE_STORAGE_KEY);
    if (ours.length) await AsyncStorage.multiRemove(ours);
  } catch {
    // ignore
  }
}

/**
 * Return cached data if fresh; optionally return stale data while revalidating.
 */
export async function fetchWithCache(key, fetchFn, { freshMs, staleMs, force = false } = {}) {
  if (!force) {
    const cached = await readCache(key, { freshMs, staleMs: staleMs ?? freshMs });
    if (cached.data != null && !cached.stale) {
      return { data: cached.data, source: cached.source, fromCache: true };
    }
    if (cached.data != null && cached.stale) {
      fetchFn()
        .then((data) => writeCache(key, data))
        .catch(() => {});
      return { data: cached.data, source: cached.source, fromCache: true, revalidating: true };
    }
  }

  const data = await fetchFn();
  await writeCache(key, data);
  return { data, source: 'network', fromCache: false };
}

export async function getCacheReport() {
  const keys = [];
  for (const [key, entry] of memory.entries()) {
    keys.push({
      key,
      ageMs: Date.now() - entry.at,
      inMemory: true,
    });
  }
  let storageCount = 0;
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    storageCount = allKeys.filter(
      (k) => k.startsWith(STORAGE_PREFIX) && k !== SCOPE_STORAGE_KEY,
    ).length;
  } catch {
    // ignore
  }
  return {
    stats: getCacheStats(),
    memoryKeys: keys,
    storageKeyCount: storageCount,
    scope: getCacheScope(),
    debugEnabled: isApiCacheDebugEnabled,
  };
}
