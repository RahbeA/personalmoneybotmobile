import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCacheScope } from './apiCache';

// Durable queue of lesson completions whose network POST failed. The lesson is
// already marked complete locally (optimistically), so this queue exists purely
// to guarantee the SERVER eventually records the completion — even if the app is
// killed before the request succeeds. Flushed on app boot and on refresh.
const STORAGE_PREFIX = '@moneybot:pendingCompletions:';

function storageKey(userId) {
  // Scope by API environment so localhost completions can't leak into prod.
  return `${STORAGE_PREFIX}${getCacheScope()}:${userId}`;
}

export async function getPendingCompletions(userId) {
  if (!userId) return [];
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writePending(userId, list) {
  try {
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(list));
  } catch {
    // disk full etc. — a lost retry only means the next successful fetch
    // reconciles slightly later; completion is never shown as regressed.
  }
}

export async function enqueuePendingCompletion(userId, { lessonId, mistakes = 0, clientDate } = {}) {
  if (!userId || lessonId == null) return;
  const list = await getPendingCompletions(userId);
  // De-dupe by lesson: one pending entry per lesson is enough.
  if (list.some((e) => e.lessonId === lessonId)) return;
  list.push({ lessonId, mistakes, clientDate, queuedAt: Date.now() });
  await writePending(userId, list);
}

export async function dequeuePendingCompletion(userId, lessonId) {
  if (!userId) return;
  const list = await getPendingCompletions(userId);
  const next = list.filter((e) => e.lessonId !== lessonId);
  if (next.length !== list.length) await writePending(userId, next);
}

export async function clearPendingCompletions(userId) {
  if (!userId) return;
  try {
    await AsyncStorage.removeItem(storageKey(userId));
  } catch {
    // ignore
  }
}
