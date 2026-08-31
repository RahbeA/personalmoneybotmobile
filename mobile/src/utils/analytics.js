import Constants from 'expo-constants';
import PostHog from 'posthog-react-native';

const SENSITIVE_KEY = /email|message|content|body|invite|password|token|glb|url/i;

let client = null;
let appOpenedSent = false;
let lastScreen = null;

export const ANALYTICS_EVENTS = {
  APP_OPENED: 'app_opened',
  SIGNUP_SUCCEEDED: 'signup_succeeded',
  LOGIN_SUCCEEDED: 'login_succeeded',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  LESSON_STARTED: 'lesson_started',
  LESSON_COMPLETED: 'lesson_completed',
  DAILY_PUZZLE_COMPLETED: 'daily_puzzle_completed',
  DAILY_CLAIM: 'daily_claim',
  CHARACTER_PURCHASED: 'character_purchased',
  CHARACTER_EQUIPPED: 'character_equipped',
  INVITE_SHARED: 'invite_shared',
  PAYWALL_VIEWED: 'paywall_viewed',
  PERSONALITY_CHANGED: 'personality_changed',
};

/** Screen names that imply a product event without editing those screens. */
export const SCREEN_EVENT_MAP = {
  LessonIntro: ANALYTICS_EVENTS.LESSON_STARTED,
  LessonComplete: ANALYTICS_EVENTS.LESSON_COMPLETED,
  Paywall: ANALYTICS_EVENTS.PAYWALL_VIEWED,
};

export function getPostHogApiKey() {
  return (
    process.env.EXPO_PUBLIC_POSTHOG_API_KEY
    || Constants.expoConfig?.extra?.posthogApiKey
    || ''
  ).trim();
}

export function getPostHogHost() {
  return (
    process.env.EXPO_PUBLIC_POSTHOG_HOST
    || Constants.expoConfig?.extra?.posthogHost
    || 'https://us.i.posthog.com'
  ).trim();
}

function sanitizeProps(properties) {
  if (!properties || typeof properties !== 'object') return undefined;
  const next = {};
  Object.entries(properties).forEach(([key, value]) => {
    if (SENSITIVE_KEY.test(key)) return;
    if (value == null) return;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      next[key] = value;
    }
  });
  return Object.keys(next).length ? next : undefined;
}

export function getPostHogClient() {
  if (client) return client;
  const apiKey = getPostHogApiKey();
  if (!apiKey) return null;
  try {
    client = new PostHog(apiKey, {
      host: getPostHogHost(),
      captureAppLifecycleEvents: false,
      enableSessionReplay: false,
    });
  } catch {
    client = null;
  }
  return client;
}

export function track(event, properties) {
  if (!event) return;
  getPostHogClient()?.capture(event, sanitizeProps(properties));
}

export function identifyUser(userId, properties) {
  if (!userId) return;
  getPostHogClient()?.identify(String(userId), sanitizeProps(properties));
}

export function resetAnalytics() {
  getPostHogClient()?.reset();
}

export function screen(name) {
  if (!name || name === lastScreen) return;
  lastScreen = name;
  const ph = getPostHogClient();
  if (!ph) return;
  ph.screen(name);
  const mapped = SCREEN_EVENT_MAP[name];
  if (mapped) track(mapped, { screen: name });
}

export function trackAppOpened() {
  if (appOpenedSent) return;
  appOpenedSent = true;
  track(ANALYTICS_EVENTS.APP_OPENED);
}

export function getActiveRouteName(state) {
  if (!state) return null;
  const route = state.routes[state.index];
  if (route?.state) return getActiveRouteName(route.state);
  return route?.name || null;
}
