import { API_BASE_URL } from '../config/api';

/** Map Django media paths to the configured API host (handles localhost vs LAN IP). */
export function resolveMediaUrl(url) {
  if (!url) return null;

  const apiOrigin = API_BASE_URL.replace(/\/api\/?$/, '');

  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const parsed = new URL(url);
      return `${apiOrigin}${parsed.pathname}${parsed.search}`;
    } catch {
      return url;
    }
  }

  return `${apiOrigin}${url.startsWith('/') ? url : `/${url}`}`;
}
