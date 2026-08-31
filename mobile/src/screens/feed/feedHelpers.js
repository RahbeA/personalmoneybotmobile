export function formatDisplayName(name) {
  if (!name) return 'Learner';
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

export function timeAgo(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return 'Just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

/** Production feed images must be https. Local http is OK in dev. */
export function safeHttpsUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('https://')) return trimmed;
  if (
    __DEV__
    && /^http:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)[:/]/i.test(trimmed)
  ) {
    return trimmed;
  }
  return null;
}

export function normalizeLink(raw) {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function isPlausibleLink(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:') return true;
    return __DEV__ && parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export const FEED_CACHE_KEYS = {
  approved: () => 'feed:approved',
  mine: (userId) => `feed:mine:${userId || 'me'}`,
};

export const STATUS_LABELS = {
  pending: 'Waiting on review',
  approved: 'Live',
  rejected: "Didn't go live",
};
