const BASE_URL = 'http://localhost:8000/api';

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
};
