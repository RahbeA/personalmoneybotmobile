import { API_BASE_URL } from '../config/api';

const BASE_URL = API_BASE_URL;

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const data = await response.json();

  if (!response.ok) {
    const message =
      data?.detail ||
      data?.non_field_errors?.[0] ||
      data?.email?.[0] ||
      data?.password?.[0] ||
      'Something went wrong';
    throw new Error(message);
  }

  return data;
}

export const authApi = {
  login: (email, password) =>
    request('/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (email, password) =>
    request('/auth/register/', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  google: (idToken) =>
    request('/auth/google/', {
      method: 'POST',
      body: JSON.stringify({ id_token: idToken }),
    }),

  apple: ({ identityToken, email, fullName }) =>
    request('/auth/apple/', {
      method: 'POST',
      body: JSON.stringify({
        identity_token: identityToken,
        email: email || undefined,
        full_name: fullName || undefined,
      }),
    }),

  logout: (token) =>
    request('/auth/logout/', {
      method: 'POST',
      headers: { Authorization: `Token ${token}` },
    }),

  getProfile: (token) =>
    request('/auth/profile/', {
      method: 'GET',
      headers: { Authorization: `Token ${token}` },
    }),

  deleteAccount: (token) =>
    request('/auth/account/', {
      method: 'DELETE',
      headers: { Authorization: `Token ${token}` },
    }),
};
