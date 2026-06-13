/**
 * Resolve a Django media URL for same-origin loading.
 * In dev the panel runs on :5173 but media lives on :8000 — always use the
 * relative /media/... path so Vite's proxy serves it same-origin.
 */
export function resolveMediaUrl(url) {
  if (!url) return null;

  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  }

  return url.startsWith('/') ? url : `/${url}`;
}
