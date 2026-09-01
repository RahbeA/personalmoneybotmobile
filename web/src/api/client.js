const BASE_URL = import.meta.env.VITE_API_BASE || '/api/admin';

const TOKEN_KEY = 'moneybotAdminToken';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function extractMessage(data) {
  if (!data) return 'Something went wrong';
  if (typeof data === 'string') return data;
  if (data.detail) return data.detail;
  if (Array.isArray(data.non_field_errors)) return data.non_field_errors[0];
  // Surface the first field error if present.
  const firstKey = Object.keys(data)[0];
  if (firstKey) {
    const val = data[firstKey];
    if (Array.isArray(val)) return `${firstKey}: ${val[0]}`;
    if (typeof val === 'string') return `${firstKey}: ${val}`;
  }
  return 'Something went wrong';
}

async function request(endpoint, { method = 'GET', body, isForm = false, headers = {} } = {}) {
  const opts = { method, headers: { ...headers } };

  const token = getToken();
  if (token) opts.headers.Authorization = `Token ${token}`;

  if (body !== undefined && body !== null) {
    if (isForm) {
      opts.body = body; // FormData: let the browser set the multipart boundary.
    } else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, opts).catch(() => {
    throw new Error('Cannot reach the API. Make sure the backend is running on port 8000.');
  });

  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(extractMessage(data));
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  get: (endpoint) => request(endpoint),
  post: (endpoint, body) => request(endpoint, { method: 'POST', body }),
  postForm: (endpoint, formData) => request(endpoint, { method: 'POST', body: formData, isForm: true }),
  patch: (endpoint, body) => request(endpoint, { method: 'PATCH', body }),
  patchForm: (endpoint, formData) => request(endpoint, { method: 'PATCH', body: formData, isForm: true }),
  put: (endpoint, body) => request(endpoint, { method: 'PUT', body }),
  del: (endpoint) => request(endpoint, { method: 'DELETE' }),
};
