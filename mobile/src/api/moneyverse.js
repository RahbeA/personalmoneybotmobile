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

export const moneyverseApi = {
  getCharacters: (token) => request('/moneyverse/characters/', token),

  purchaseCharacter: (token, characterId) =>
    request(`/moneyverse/characters/${characterId}/purchase/`, token, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  equipCharacter: (token, characterId) =>
    request('/moneyverse/equip/', token, {
      method: 'POST',
      body: JSON.stringify({ character_id: characterId }),
    }),
};
