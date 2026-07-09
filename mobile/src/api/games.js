import { apiRequest } from './client';
import { localDate } from '../utils/localDate';

export const gamesApi = {
  getArcade: (token) =>
    apiRequest(`/games/?client_date=${localDate()}`, { token }),

  startGame: (token, gameKey) =>
    apiRequest(`/games/${gameKey}/start/`, {
      method: 'POST',
      token,
      body: { client_date: localDate() },
    }),

  finishGame: (token, gameKey, sessionId, score) =>
    apiRequest(`/games/${gameKey}/finish/`, {
      method: 'POST',
      token,
      body: { session_id: sessionId, score },
    }),
};
