import { apiRequest } from './client';
import { localDate } from '../utils/localDate';

export const dailyApi = {
  getToday: (token) =>
    apiRequest(`/daily/?client_date=${localDate()}`, { token }),

  submit: (token, answers, totalTimeMs) =>
    apiRequest('/daily/submit/', {
      method: 'POST',
      token,
      body: { client_date: localDate(), answers, total_time_ms: totalTimeMs },
    }),

  getLeaderboard: (token) =>
    apiRequest(`/daily/leaderboard/?client_date=${localDate()}`, { token }),
};
