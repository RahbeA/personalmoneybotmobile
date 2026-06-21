import { apiRequest } from './client';

export const tutorApi = {
  getConversations: (token) => apiRequest('/ai/tutor/conversations/', { token }),

  createConversation: (token) =>
    apiRequest('/ai/tutor/conversations/', { method: 'POST', token, body: {} }),

  getMessages: (token, conversationId) =>
    apiRequest(`/ai/tutor/conversations/${conversationId}/messages/`, { token }),

  sendMessage: (token, message, conversationId = null) =>
    apiRequest('/ai/tutor/chat/', {
      method: 'POST',
      token,
      body: { message, conversation_id: conversationId },
    }),
};
