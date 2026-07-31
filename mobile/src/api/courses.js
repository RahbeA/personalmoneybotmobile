import { apiRequest } from './client';
import { localDate } from '../utils/localDate';

export const coursesApi = {
  getModules: (token) => apiRequest('/courses/modules/', { token }),

  getModuleLessons: (token, moduleId) =>
    apiRequest(`/courses/modules/${moduleId}/lessons/`, { token }),

  getLessonQuestions: (token, lessonId) =>
    apiRequest(`/courses/lessons/${lessonId}/questions/`, { token }),

  completeLesson: (token, lessonId, mistakes = 0) =>
    apiRequest(`/courses/lessons/${lessonId}/complete/`, {
      method: 'POST',
      token,
      body: { mistakes, client_date: localDate() },
    }),

  getStats: (token) =>
    apiRequest(`/courses/stats/?client_date=${localDate()}`, { token }),

  claimDailyReward: (token, { streakGoal } = {}) =>
    apiRequest('/courses/daily-reward/claim/', {
      method: 'POST',
      token,
      body: {
        client_date: localDate(),
        ...(streakGoal != null ? { streak_goal: streakGoal } : {}),
      },
    }),

  updateStreakGoal: (token, streakGoal) =>
    apiRequest('/courses/streak-goal/', {
      method: 'PATCH',
      token,
      body: { streak_goal: streakGoal },
    }),

  getLeaderboard: (token, { page = 1, pageSize = 20, search = '' } = {}) => {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (search.trim()) params.set('search', search.trim());
    return apiRequest(`/courses/leaderboard/?${params.toString()}`, { token });
  },

  getOnboardingQuestions: (token) => apiRequest('/courses/onboarding/questions/', { token }),

  submitOnboarding: (token, answers, goals = []) =>
    apiRequest('/courses/onboarding/submit/', {
      method: 'POST',
      token,
      body: { answers, goals },
    }),

  updateGoals: (token, goals = []) =>
    apiRequest('/courses/goals/', {
      method: 'PATCH',
      token,
      body: { goals },
    }),
};
