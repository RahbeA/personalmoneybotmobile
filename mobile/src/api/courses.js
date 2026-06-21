import { apiRequest } from './client';

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
      body: { mistakes },
    }),

  getStats: (token) => apiRequest('/courses/stats/', { token }),

  claimDailyReward: (token) =>
    apiRequest('/courses/daily-reward/claim/', { method: 'POST', token }),

  getLeaderboard: (token, { page = 1, pageSize = 20, search = '' } = {}) => {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (search.trim()) params.set('search', search.trim());
    return apiRequest(`/courses/leaderboard/?${params.toString()}`, { token });
  },

  getOnboardingQuestions: (token) => apiRequest('/courses/onboarding/questions/', { token }),

  submitOnboarding: (token, answers) =>
    apiRequest('/courses/onboarding/submit/', {
      method: 'POST',
      token,
      body: { answers },
    }),
};
