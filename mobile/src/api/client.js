import { API_BASE_URL } from '../config/api';

let onUnauthorized = null;

/** Register a handler for 401 responses (e.g. clear a stale local-dev token). */
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

async function parseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function extractError(data, fallback) {
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (data.detail) return data.detail;
  if (data.error) return data.error;
  if (Array.isArray(data.non_field_errors)) return data.non_field_errors[0];
  const firstKey = Object.keys(data)[0];
  if (firstKey) {
    const val = data[firstKey];
    if (Array.isArray(val)) return `${firstKey}: ${val[0]}`;
    if (typeof val === 'string') return val;
  }
  return fallback;
}

/**
 * Shared fetch wrapper for all mobile API modules.
 * Logs the full URL in dev so you can confirm production is being hit.
 */
export async function apiRequest(
  endpoint,
  { method = 'GET', token, body, headers = {}, skipUnauthorizedHandler = false } = {},
) {
  const url = `${API_BASE_URL}${endpoint}`;

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(`[MoneyBot] ${method} ${url}`);
  }

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Token ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (__DEV__) {
    const cacheStatus = response.headers?.get?.('X-Cache-Status');
    if (cacheStatus) {
      // eslint-disable-next-line no-console
      console.log(`[MoneyBot] cache=${cacheStatus} ${endpoint}`);
    }
  }

  const data = await parseJson(response);

  if (response.status === 401 && onUnauthorized && !skipUnauthorizedHandler) {
    onUnauthorized();
  }

  if (!response.ok) {
    const error = new Error(extractError(data, `Request failed (${response.status})`));
    error.status = response.status;
    error.data = data;
    if (data?.code) error.code = data.code;
    throw error;
  }

  return data;
}
