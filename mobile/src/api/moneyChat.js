import { apiRequest } from './client';

export const moneyChatApi = {
  start: (token, moduleId) =>
    apiRequest('/ai/money-chat/start/', {
      method: 'POST',
      token,
      body: { module_id: moduleId },
    }),

  sendMessage: (token, sessionId, message) =>
    apiRequest('/ai/money-chat/message/', {
      method: 'POST',
      token,
      body: { session_id: sessionId, message },
    }),
};
