import { apiRequest } from './client';

export const authApi = {
  login: (email, password) =>
    apiRequest('/auth/login/', { method: 'POST', body: { email, password } }),

  register: (email, password, name) =>
    apiRequest('/auth/register/', { method: 'POST', body: { email, password, name } }),

  google: (idToken) =>
    apiRequest('/auth/google/', { method: 'POST', body: { id_token: idToken } }),

  apple: ({ identityToken, email, fullName }) =>
    apiRequest('/auth/apple/', {
      method: 'POST',
      body: {
        identity_token: identityToken,
        email: email || undefined,
        full_name: fullName || undefined,
      },
    }),

  logout: (token) =>
    apiRequest('/auth/logout/', { method: 'POST', token }),

  getProfile: (token) =>
    apiRequest('/auth/profile/', { token }),

  updateProfile: (token, fields) =>
    apiRequest('/auth/profile/', { method: 'PATCH', token, body: fields }),

  deleteAccount: (token) =>
    apiRequest('/auth/account/', { method: 'DELETE', token }),
};
