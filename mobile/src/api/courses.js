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

export const coursesApi = {
  getModules: (token) => request('/courses/modules/', token),

  getModuleLessons: (token, moduleId) =>
    request(`/courses/modules/${moduleId}/lessons/`, token),

  getLessonQuestions: (token, lessonId) =>
    request(`/courses/lessons/${lessonId}/questions/`, token),

  completeLesson: (token, lessonId, mistakes = 0) =>
    request(`/courses/lessons/${lessonId}/complete/`, token, {
      method: 'POST',
      body: JSON.stringify({ mistakes }),
    }),

  getStats: (token) => request('/courses/stats/', token),

  getOnboardingQuestions: (token) => request('/courses/onboarding/questions/', token),

  submitOnboarding: (token, answers) =>
    request('/courses/onboarding/submit/', token, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    }),
};
