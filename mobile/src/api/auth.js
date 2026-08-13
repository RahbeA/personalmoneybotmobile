import { apiRequest } from './client';

export const authApi = {
  login: (email, password) =>
    apiRequest('/auth/login/', { method: 'POST', body: { email, password } }),

  register: (email, password, name, upgradeToken, inviteCode) =>
    apiRequest('/auth/register/', {
      method: 'POST',
      body: {
        email,
        password,
        name,
        ...(inviteCode ? { invite_code: inviteCode } : {}),
      },
      token: upgradeToken,
    }),

  guest: () => apiRequest('/auth/guest/', { method: 'POST' }),

  google: (idToken, upgradeToken, inviteCode) =>
    apiRequest('/auth/google/', {
      method: 'POST',
      body: {
        id_token: idToken,
        ...(inviteCode ? { invite_code: inviteCode } : {}),
      },
      token: upgradeToken,
    }),

  apple: ({ identityToken, email, fullName }, upgradeToken, inviteCode) =>
    apiRequest('/auth/apple/', {
      method: 'POST',
      body: {
        identity_token: identityToken,
        email: email || undefined,
        full_name: fullName || undefined,
        ...(inviteCode ? { invite_code: inviteCode } : {}),
      },
      token: upgradeToken,
    }),

  logout: (token) =>
    apiRequest('/auth/logout/', { method: 'POST', token }),

  getProfile: (token, opts = {}) =>
    apiRequest('/auth/profile/', { token, ...opts }),

  updateProfile: (token, fields) =>
    apiRequest('/auth/profile/', { method: 'PATCH', token, body: fields }),

  deleteAccount: (token) =>
    apiRequest('/auth/account/', { method: 'DELETE', token }),

  getInviteStatus: () =>
    apiRequest('/auth/invite/status/'),

  validateInvite: (code) =>
    apiRequest('/auth/invite/validate/', {
      method: 'POST',
      body: { invite_code: code },
    }),

  getMyInvites: (token) =>
    apiRequest('/auth/invites/', { token }),

  regenerateInvite: (token) =>
    apiRequest('/auth/invites/regenerate/', { method: 'POST', token }),
};
