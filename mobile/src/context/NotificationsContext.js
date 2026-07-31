import React, {
  createContext, useContext, useState, useEffect, useCallback, useRef,
} from 'react';
import { AppState, Platform } from 'react-native';
import { useAuth } from './AuthContext';
import { notificationsApi } from '../api/notifications';
import {
  presentLocalNotification,
  registerForPushNotificationsAsync,
  addNotificationListeners,
  getLastNotificationResponse,
} from '../utils/notifications';
import { handleNotificationNavigation } from '../navigation/rootNavigation';

const NotificationsContext = createContext(null);

const POLL_INTERVAL_MS = 30000;

function extractNotificationData(responseOrNotification) {
  const content = responseOrNotification?.notification?.request?.content
    || responseOrNotification?.request?.content
    || {};
  return content.data || {};
}

export function NotificationsProvider({ children }) {
  const { token, user, isGuest } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Highest notification id we've already surfaced a local banner for. `null`
  // means "not initialised yet" so we don't spam banners for the backlog that
  // already existed when the app launched.
  const seenMaxIdRef = useRef(null);
  const pollRef = useRef(null);
  const pushTokenRef = useRef(null);
  const prevAuthTokenRef = useRef(token);

  const registerPush = useCallback(async () => {
    // Guests have no durable identity — don't register push for them.
    if (!token || isGuest || !user?.id) return;
    try {
      const pushToken = await registerForPushNotificationsAsync();
      if (!pushToken) return;

      // Always (re)register with the backend so a user switch on the same
      // device moves the token, and a failed first attempt can retry.
      await notificationsApi.registerPushToken(token, pushToken, Platform.OS);
      pushTokenRef.current = pushToken;
    } catch (e) {
      // Push is best-effort; in-app notifications still work without it.
      pushTokenRef.current = null;
    }
  }, [token, isGuest, user?.id]);

  const unregisterPush = useCallback(async (authToken) => {
    const pushToken = pushTokenRef.current;
    pushTokenRef.current = null;
    if (!pushToken || !authToken) return;
    try {
      await notificationsApi.unregisterPushToken(authToken, pushToken);
    } catch {
      // best-effort
    }
  }, []);

  const alertForNewItems = useCallback((items) => {
    if (!items?.length) return;
    const maxId = items.reduce((max, n) => Math.max(max, n.id), 0);

    if (seenMaxIdRef.current === null) {
      // First load — establish the baseline without alerting.
      seenMaxIdRef.current = maxId;
      return;
    }

    const fresh = items
      .filter((n) => n.id > seenMaxIdRef.current && !n.is_read)
      .sort((a, b) => a.id - b.id);

    // Prefer remote Expo push when registered. Local banners remain a fallback
    // only when we somehow have no push token (simulator / permission denied).
    if (!pushTokenRef.current) {
      fresh.forEach((n) => {
        presentLocalNotification(n.title, n.body, { ...n.data, kind: n.kind }).catch(() => {});
      });
    }

    if (maxId > seenMaxIdRef.current) {
      seenMaxIdRef.current = maxId;
    }
  }, []);

  const refresh = useCallback(async ({ silent = true } = {}) => {
    if (!token || isGuest) return null;
    if (!silent) setLoading(true);
    try {
      const data = await notificationsApi.list(token);
      const items = data.notifications || [];
      setNotifications(items);
      setUnreadCount(data.unread_count ?? 0);
      alertForNewItems(items);
      return data;
    } catch (e) {
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }, [token, isGuest, alertForNewItems]);

  const pollUnread = useCallback(async () => {
    if (!token || isGuest) return;
    try {
      const data = await notificationsApi.unreadCount(token);
      const next = data.unread_count ?? 0;
      // Only pull the (heavier) full list when something changed, so we can
      // fire banners for the new arrivals.
      if (next !== unreadCount || (next > 0 && seenMaxIdRef.current === null)) {
        await refresh();
      } else {
        setUnreadCount(next);
      }
    } catch (e) {
      // ignore transient poll failures
    }
  }, [token, isGuest, unreadCount, refresh]);

  const markRead = useCallback(async (notificationId) => {
    if (!token) return;
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      const data = await notificationsApi.markRead(token, notificationId);
      if (typeof data?.unread_count === 'number') setUnreadCount(data.unread_count);
    } catch (e) {
      // optimistic update stands; a later poll will reconcile
    }
  }, [token]);

  const markAllRead = useCallback(async () => {
    if (!token) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try {
      await notificationsApi.markAllRead(token);
    } catch (e) {
      // ignore; poll will reconcile
    }
  }, [token]);

  // Reset state on sign-out / user switch.
  useEffect(() => {
    const previousToken = prevAuthTokenRef.current;
    prevAuthTokenRef.current = token;

    if (!token || !user?.id || isGuest) {
      if (!token && previousToken) {
        unregisterPush(previousToken);
      }
      setNotifications([]);
      setUnreadCount(0);
      seenMaxIdRef.current = null;
      return undefined;
    }

    seenMaxIdRef.current = null;
    refresh();
    registerPush();

    pollRef.current = setInterval(() => {
      pollUnread();
    }, POLL_INTERVAL_MS);

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        pollUnread();
        registerPush();
      }
    });

    // Keep the badge/list fresh when a remote push arrives or is tapped, and
    // deep-link into the right Social screen on tap.
    const removePushListeners = addNotificationListeners({
      onReceive: () => pollUnread(),
      onRespond: (response) => {
        pollUnread();
        handleNotificationNavigation(extractNotificationData(response));
      },
    });

    // Cold-start: user tapped a notification that launched the app.
    getLastNotificationResponse().then((response) => {
      if (response) {
        handleNotificationNavigation(extractNotificationData(response));
      }
    }).catch(() => {});

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      sub.remove();
      removePushListeners();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.id, isGuest]);

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        refresh,
        markRead,
        markAllRead,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
