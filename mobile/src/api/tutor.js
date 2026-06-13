import { API_BASE_URL } from '../config/api';

const BASE_URL = API_BASE_URL;

async function request(endpoint, token, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Token ${token}`,
      ...options.headers,
    },
    ...options,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.detail || 'Something went wrong');
  }

  return data;
}

export const tutorApi = {
  getConversations: (token) => request('/ai/tutor/conversations/', token),

  createConversation: (token) =>
    request('/ai/tutor/conversations/', token, { method: 'POST', body: JSON.stringify({}) }),

  getMessages: (token, conversationId) =>
    request(`/ai/tutor/conversations/${conversationId}/messages/`, token),

  sendMessage: (token, message, conversationId = null) =>
    request('/ai/tutor/chat/', token, {
      method: 'POST',
      body: JSON.stringify({ message, conversation_id: conversationId }),
    }),
};
