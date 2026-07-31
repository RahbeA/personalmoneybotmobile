import { apiRequest } from './client';

const inFlight = new Map();

function dedupe(key, fn) {
  if (inFlight.has(key)) return inFlight.get(key);
  const promise = fn().finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

export const moneyverseApi = {
  getCharacters: (token) =>
    dedupe(`characters:${token}`, () => apiRequest('/moneyverse/characters/', { token })),

  purchaseCharacter: (token, characterId) =>
    apiRequest(`/moneyverse/characters/${characterId}/purchase/`, {
      method: 'POST',
      token,
      body: {},
    }),

  equipCharacter: (token, characterId) =>
    apiRequest('/moneyverse/equip/', {
      method: 'POST',
      token,
      body: { character_id: characterId },
    }),

  claimStarter: (token) =>
    apiRequest('/moneyverse/claim-starter/', {
      method: 'POST',
      token,
      body: {},
    }),
};
