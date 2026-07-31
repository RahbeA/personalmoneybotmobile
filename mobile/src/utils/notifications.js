import { requireOptionalNativeModule } from 'expo-modules-core';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const PREFS_KEY = 'notificationPrefs';

export const NOTIFICATION_IDS = {
  DAILY: 'moneybot-daily-reminder',
  STREAK: 'moneybot-streak-alert',
  NEW_CONTENT: 'moneybot-new-content',
};

/** Rolling streak reminders use moneybot-streak-alert-0 … -6 */
export const STREAK_WINDOW_DAYS = 7;
export const STREAK_REMINDER_HOUR = 20;
export const STREAK_REMINDER_MINUTE = 0;

/** Rolling daily reminders use moneybot-daily-reminder-0 … -13 (rotating copy). */
export const DAILY_WINDOW_DAYS = 14;
export const DAILY_REMINDER_HOUR = 18;
export const DAILY_REMINDER_MINUTE = 0;

// A rotating set of daily reminder messages so the notification feels fresh
// each day instead of repeating the same line. Each builder takes the user's
// first name (may be empty) and returns { title, body }.
const DAILY_MESSAGE_BUILDERS = [
  (n) => ({
    title: n ? `${n}, ready for today's lesson?` : "Ready for today's lesson?",
    body: 'A few minutes now keeps your money skills sharp.',
  }),
  (n) => ({
    title: 'Your daily money move',
    body: n ? `${n}, one quick lesson keeps your momentum going.` : 'One quick lesson keeps your momentum going.',
  }),
  (n) => ({
    title: n ? `Let's learn something, ${n}` : "Let's learn something new",
    body: "Today's lesson is waiting — jump back in.",
  }),
  (n) => ({
    title: 'Small steps, big money wins',
    body: n ? `${n}, spend 5 minutes leveling up your finances.` : 'Spend 5 minutes leveling up your finances.',
  }),
  (n) => ({
    title: n ? `Keep it going, ${n}!` : 'Keep it going!',
    body: 'A quick MoneyBot session keeps you on track.',
  }),
  (n) => ({
    title: 'Time to grow your Bot Bucks',
    body: n ? `${n}, finish a lesson and stack more rewards.` : 'Finish a lesson and stack more rewards.',
  }),
  (n) => ({
    title: n ? `${n}, your money brain called` : 'Your money brain called',
    body: 'It wants a quick workout — hop into a lesson.',
  }),
];

export const DEFAULT_NOTIFICATION_PREFS = {
  daily: true,
  streak: true,
  newContent: false,
};

const REBUILD_HINT = 'Rebuild the app to enable notifications:\n\ncd mobile && npx expo run:ios';

const TEST_SAMPLES = {
  daily: {
    title: 'Time for MoneyBot',
    body: 'Complete a quick lesson and keep building your financial skills.',
  },
  streak: {
    title: "Don't break your streak!",
    body: 'You still have time today — jump in and keep your momentum going.',
  },
  newContent: {
    title: 'New on MoneyBot',
    body: 'Fresh courses and features may be waiting for you — come check it out.',
  },
};

let Notifications = null; // null = unchecked, false = unavailable, object = module
let androidChannelReady = false;
let handlerConfigured = false;

/** True when the native notification scheduler is linked in this build. */
export function areNotificationsSupported() {
  return requireOptionalNativeModule('ExpoNotificationScheduler') != null;
}

export function getNotificationsUnavailableMessage() {
  return REBUILD_HINT;
}

function getNotificationsModule() {
  if (!areNotificationsSupported()) return null;
  if (Notifications === false) return null;
  if (Notifications) return Notifications;
  try {
    // eslint-disable-next-line global-require
    Notifications = require('expo-notifications');
    return Notifications;
  } catch {
    Notifications = false;
    return null;
  }
}

function configureNotificationHandler() {
  const mod = getNotificationsModule();
  if (!mod || handlerConfigured) return;
  mod.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  handlerConfigured = true;
}

async function ensureAndroidChannel() {
  const mod = getNotificationsModule();
  if (!mod || Platform.OS !== 'android' || androidChannelReady) return;
  await mod.setNotificationChannelAsync('reminders', {
    name: 'Reminders',
    importance: mod.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
  await mod.setNotificationChannelAsync('social', {
    name: 'Friends & social',
    importance: mod.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    description: 'Friend requests, accepts, and social updates',
  });
  androidChannelReady = true;
}

export function streakNotificationId(dayOffset) {
  return `${NOTIFICATION_IDS.STREAK}-${dayOffset}`;
}

export function dailyNotificationId(dayOffset) {
  return `${NOTIFICATION_IDS.DAILY}-${dayOffset}`;
}

/**
 * Daily reminder content for a given date. Rotates deterministically by
 * calendar day so each day shows a different message (and the same date always
 * maps to the same one). Personalized with the first name when available.
 */
export function buildDailyNotificationContent(firstName, date = new Date()) {
  const name = (firstName || '').trim();
  const dayNumber = Math.floor(date.getTime() / 86400000);
  const builder = DAILY_MESSAGE_BUILDERS[
    ((dayNumber % DAILY_MESSAGE_BUILDERS.length) + DAILY_MESSAGE_BUILDERS.length)
      % DAILY_MESSAGE_BUILDERS.length
  ];
  return builder(name);
}

export function buildStreakNotificationContent(firstName, streakDays) {
  const name = (firstName || '').trim();
  const title = name
    ? `${name}, your streak is slipping!`
    : "Don't break your streak!";
  const body = `You're on a ${streakDays}-day streak — finish a lesson before midnight to keep it alive.`;
  return { title, body };
}

function reminderDateForOffset(dayOffset) {
  const date = new Date();
  date.setHours(STREAK_REMINDER_HOUR, STREAK_REMINDER_MINUTE, 0, 0);
  date.setDate(date.getDate() + dayOffset);
  return date;
}

function isReminderTimePassedToday() {
  const now = new Date();
  const reminder = new Date();
  reminder.setHours(STREAK_REMINDER_HOUR, STREAK_REMINDER_MINUTE, 0, 0);
  return now >= reminder;
}

export async function loadNotificationPrefs() {
  try {
    const raw = await SecureStore.getItemAsync(PREFS_KEY);
    if (raw) return { ...DEFAULT_NOTIFICATION_PREFS, ...JSON.parse(raw) };
  } catch {
    // fall back to defaults
  }
  return { ...DEFAULT_NOTIFICATION_PREFS };
}

export async function saveNotificationPrefs(prefs) {
  await SecureStore.setItemAsync(PREFS_KEY, JSON.stringify(prefs));
}

export async function getNotificationPermissionStatus() {
  const mod = getNotificationsModule();
  if (!mod) return 'unsupported';
  const { status } = await mod.getPermissionsAsync();
  return status;
}

/**
 * Detailed permission state used by the onboarding opt-in so it can tell the
 * difference between "never asked" (can show the system prompt) and "already
 * denied" (must send the user to Settings).
 */
export async function getNotificationPermissionInfo() {
  const mod = getNotificationsModule();
  if (!mod) return { supported: false, status: 'unsupported', canAskAgain: false };
  const perm = await mod.getPermissionsAsync();
  return {
    supported: true,
    status: perm.status,
    canAskAgain: perm.canAskAgain !== false,
  };
}

export async function ensureNotificationPermissions() {
  const mod = getNotificationsModule();
  if (!mod) return false;
  await ensureAndroidChannel();
  const { status: existing } = await mod.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await mod.requestPermissionsAsync();
  return status === 'granted';
}

async function cancelStreakNotifications() {
  const mod = getNotificationsModule();
  if (!mod) return;
  const ids = [
    NOTIFICATION_IDS.STREAK,
    ...Array.from({ length: STREAK_WINDOW_DAYS }, (_, i) => streakNotificationId(i)),
  ];
  await Promise.all(
    ids.map((id) => mod.cancelScheduledNotificationAsync(id).catch(() => {})),
  );
}

async function cancelDailyNotifications() {
  const mod = getNotificationsModule();
  if (!mod) return;
  const ids = [
    NOTIFICATION_IDS.DAILY,
    ...Array.from({ length: DAILY_WINDOW_DAYS }, (_, i) => dailyNotificationId(i)),
  ];
  await Promise.all(
    ids.map((id) => mod.cancelScheduledNotificationAsync(id).catch(() => {})),
  );
}

async function cancelManagedNotifications() {
  const mod = getNotificationsModule();
  if (!mod) return;
  await cancelStreakNotifications();
  await cancelDailyNotifications();
  await mod.cancelScheduledNotificationAsync(NOTIFICATION_IDS.NEW_CONTENT).catch(() => {});
}

function dailyReminderDateForOffset(dayOffset) {
  const date = new Date();
  date.setHours(DAILY_REMINDER_HOUR, DAILY_REMINDER_MINUTE, 0, 0);
  date.setDate(date.getDate() + dayOffset);
  return date;
}

async function scheduleDailyNotifications(mod, firstName) {
  await cancelDailyNotifications();

  let scheduled = 0;
  for (let offset = 0; offset < DAILY_WINDOW_DAYS; offset += 1) {
    const triggerDate = dailyReminderDateForOffset(offset);
    // Skip today if 6 PM already passed.
    if (triggerDate.getTime() <= Date.now()) {
      continue;
    }

    const content = buildDailyNotificationContent(firstName, triggerDate);
    await mod.scheduleNotificationAsync({
      identifier: dailyNotificationId(offset),
      content: {
        ...content,
        sound: true,
        ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
      },
      trigger: {
        type: mod.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });
    scheduled += 1;
  }

  return scheduled;
}

async function scheduleStreakNotifications(mod, streakContext) {
  const { firstName = '', streakDays = 0, activeToday = false } = streakContext || {};

  await cancelStreakNotifications();

  if (!streakDays || streakDays <= 0) {
    return 0;
  }

  const content = buildStreakNotificationContent(firstName, streakDays);
  let scheduled = 0;

  for (let offset = 0; offset < STREAK_WINDOW_DAYS; offset += 1) {
    if (offset === 0 && (activeToday || isReminderTimePassedToday())) {
      continue;
    }

    const triggerDate = reminderDateForOffset(offset);
    if (triggerDate.getTime() <= Date.now()) {
      continue;
    }

    await mod.scheduleNotificationAsync({
      identifier: streakNotificationId(offset),
      content: {
        ...content,
        sound: true,
        ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
      },
      trigger: {
        type: mod.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });
    scheduled += 1;
  }

  return scheduled;
}

/**
 * Sync all managed local notifications. Pass streakContext when streak state
 * is known so streak alerts only fire when a streak is genuinely at risk.
 */
export async function syncNotificationSchedule(prefs, streakContext = null) {
  if (!areNotificationsSupported()) {
    return { ok: false, reason: 'unsupported' };
  }

  configureNotificationHandler();
  await cancelManagedNotifications();

  const anyEnabled = prefs.daily || prefs.streak || prefs.newContent;
  if (!anyEnabled) return { ok: true, scheduled: 0 };

  const granted = await ensureNotificationPermissions();
  if (!granted) return { ok: false, reason: 'permission_denied' };

  const mod = getNotificationsModule();
  let scheduled = 0;

  if (prefs.daily) {
    scheduled += await scheduleDailyNotifications(mod, streakContext?.firstName || '');
  }

  if (prefs.streak && streakContext) {
    scheduled += await scheduleStreakNotifications(mod, streakContext);
  }

  if (prefs.newContent) {
    await mod.scheduleNotificationAsync({
      identifier: NOTIFICATION_IDS.NEW_CONTENT,
      content: {
        title: TEST_SAMPLES.newContent.title,
        body: TEST_SAMPLES.newContent.body,
        sound: true,
        ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
      },
      trigger: {
        type: mod.SchedulableTriggerInputTypes.WEEKLY,
        weekday: 2,
        hour: 10,
        minute: 0,
      },
    });
    scheduled += 1;
  }

  return { ok: true, scheduled };
}

/** Load prefs and sync streak-aware notifications in one call. */
export async function syncStreakNotifications(streakContext) {
  const prefs = await loadNotificationPrefs();
  return syncNotificationSchedule(prefs, streakContext);
}

export async function sendTestNotification(type = 'daily') {
  if (!areNotificationsSupported()) {
    throw new Error(REBUILD_HINT);
  }

  configureNotificationHandler();
  const granted = await ensureNotificationPermissions();
  if (!granted) {
    throw new Error('Notification permission denied. Enable alerts in your device Settings.');
  }

  const mod = getNotificationsModule();
  const sample = TEST_SAMPLES[type] || TEST_SAMPLES.daily;

  await mod.scheduleNotificationAsync({
    content: {
      ...sample,
      sound: true,
      ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
    },
    trigger: {
      type: mod.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 1,
    },
  });
}

/**
 * Present a notification right now (used when the client detects a new social
 * event while running). This surfaces an OS banner without needing a remote
 * push service. It is best-effort and silently no-ops when unsupported or when
 * the user hasn't granted permission.
 */
export async function presentLocalNotification(title, body, data = {}) {
  if (!areNotificationsSupported()) return false;

  configureNotificationHandler();
  const status = await getNotificationPermissionStatus();
  if (status !== 'granted') return false;

  const mod = getNotificationsModule();
  if (!mod) return false;

  const channelId = data?.kind?.startsWith?.('friend') || data?.kind === 'announcement'
    ? 'social'
    : 'reminders';

  try {
    await mod.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
        ...(Platform.OS === 'android' ? { channelId } : {}),
      },
      trigger: {
        type: mod.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
      },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Subscribe to incoming push events. Returns an unsubscribe function.
 * - onReceive: fires when a notification arrives while the app is foregrounded
 * - onRespond: fires when the user taps a notification (foreground/background)
 */
export function addNotificationListeners({ onReceive, onRespond } = {}) {
  const mod = getNotificationsModule();
  if (!mod) return () => {};
  configureNotificationHandler();
  const subs = [];
  if (onReceive) subs.push(mod.addNotificationReceivedListener(onReceive));
  if (onRespond) subs.push(mod.addNotificationResponseReceivedListener(onRespond));
  return () => subs.forEach((s) => s?.remove?.());
}

/** Notification that launched / resumed the app via a tap, if any. */
export async function getLastNotificationResponse() {
  const mod = getNotificationsModule();
  if (!mod?.getLastNotificationResponseAsync) return null;
  try {
    return await mod.getLastNotificationResponseAsync();
  } catch {
    return null;
  }
}

function getExpoProjectId() {
  return (
    Constants?.expoConfig?.extra?.eas?.projectId
    || Constants?.easConfig?.projectId
    || null
  );
}

/**
 * Register this device for remote (Expo) push notifications and return the
 * Expo push token string, or null when unavailable/denied. Safe to call
 * repeatedly. Requires a build with push credentials configured.
 */
export async function registerForPushNotificationsAsync() {
  if (!areNotificationsSupported()) return null;

  configureNotificationHandler();
  await ensureAndroidChannel();

  const granted = await ensureNotificationPermissions();
  if (!granted) return null;

  const mod = getNotificationsModule();
  if (!mod) return null;

  try {
    const projectId = getExpoProjectId();
    const { data } = await mod.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return data || null;
  } catch {
    return null;
  }
}

export async function bootstrapNotifications() {
  if (!areNotificationsSupported()) return { ok: false, reason: 'unsupported' };

  configureNotificationHandler();
  const prefs = await loadNotificationPrefs();
  const status = await getNotificationPermissionStatus();
  if (status === 'granted') {
    return syncNotificationSchedule(prefs);
  }
  return { ok: true, scheduled: 0 };
}
