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

export const moneyChatApi = {
  start: (token, moduleId) =>
    request('/ai/money-chat/start/', token, {
      method: 'POST',
      body: JSON.stringify({ module_id: moduleId }),
    }),

  sendMessage: (token, sessionId, message) =>
    request('/ai/money-chat/message/', token, {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId, message }),
    }),
};
