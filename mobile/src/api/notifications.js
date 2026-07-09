import { apiRequest } from './client';

export const notificationsApi = {
  list: (token) =>
    apiRequest('/social/notifications/', { token }),

  unreadCount: (token) =>
    apiRequest('/social/notifications/unread-count/', { token }),

  markRead: (token, notificationId) =>
    apiRequest(`/social/notifications/${notificationId}/read/`, {
      method: 'POST',
      token,
    }),

  markAllRead: (token) =>
    apiRequest('/social/notifications/read-all/', {
      method: 'POST',
      token,
    }),

  registerPushToken: (token, pushToken, platform) =>
    apiRequest('/social/notifications/push-token/', {
      method: 'POST',
      token,
      body: { token: pushToken, platform },
    }),

  unregisterPushToken: (token, pushToken) =>
    apiRequest('/social/notifications/push-token/', {
      method: 'DELETE',
      token,
      body: { token: pushToken },
    }),
};
