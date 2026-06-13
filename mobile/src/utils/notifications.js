import { requireOptionalNativeModule } from 'expo-modules-core';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const PREFS_KEY = 'notificationPrefs';

export const NOTIFICATION_IDS = {
  DAILY: 'moneybot-daily-reminder',
  STREAK: 'moneybot-streak-alert',
  NEW_CONTENT: 'moneybot-new-content',
};

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
  androidChannelReady = true;
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

export async function ensureNotificationPermissions() {
  const mod = getNotificationsModule();
  if (!mod) return false;
  await ensureAndroidChannel();
  const { status: existing } = await mod.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await mod.requestPermissionsAsync();
  return status === 'granted';
}

async function cancelManagedNotifications() {
  const mod = getNotificationsModule();
  if (!mod) return;
  await Promise.all(
    Object.values(NOTIFICATION_IDS).map((id) =>
      mod.cancelScheduledNotificationAsync(id).catch(() => {}),
    ),
  );
}

export async function syncNotificationSchedule(prefs) {
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
    await mod.scheduleNotificationAsync({
      identifier: NOTIFICATION_IDS.DAILY,
      content: {
        title: TEST_SAMPLES.daily.title,
        body: TEST_SAMPLES.daily.body,
        sound: true,
        ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
      },
      trigger: {
        type: mod.SchedulableTriggerInputTypes.DAILY,
        hour: 18,
        minute: 0,
      },
    });
    scheduled += 1;
  }

  if (prefs.streak) {
    await mod.scheduleNotificationAsync({
      identifier: NOTIFICATION_IDS.STREAK,
      content: {
        title: TEST_SAMPLES.streak.title,
        body: TEST_SAMPLES.streak.body,
        sound: true,
        ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
      },
      trigger: {
        type: mod.SchedulableTriggerInputTypes.DAILY,
        hour: 20,
        minute: 0,
      },
    });
    scheduled += 1;
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
