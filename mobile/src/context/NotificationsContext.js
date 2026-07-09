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
} from '../utils/notifications';

const NotificationsContext = createContext(null);

const POLL_INTERVAL_MS = 30000;

export function NotificationsProvider({ children }) {
  const { token, user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Highest notification id we've already surfaced a local banner for. `null`
  // means "not initialised yet" so we don't spam banners for the backlog that
  // already existed when the app launched.
  const seenMaxIdRef = useRef(null);
  const pollRef = useRef(null);
  const pushTokenRef = useRef(null);

  const registerPush = useCallback(async () => {
    if (!token || pushTokenRef.current) return;
    try {
      const pushToken = await registerForPushNotificationsAsync();
      if (pushToken) {
        pushTokenRef.current = pushToken;
        await notificationsApi.registerPushToken(token, pushToken, Platform.OS);
      }
    } catch (e) {
      // Push is best-effort; in-app notifications still work without it.
    }
  }, [token]);

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

    fresh.forEach((n) => {
      presentLocalNotification(n.title, n.body, { ...n.data, kind: n.kind }).catch(() => {});
    });

    if (maxId > seenMaxIdRef.current) {
      seenMaxIdRef.current = maxId;
    }
  }, []);

  const refresh = useCallback(async ({ silent = true } = {}) => {
    if (!token) return null;
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
  }, [token, alertForNewItems]);

  const pollUnread = useCallback(async () => {
    if (!token) return;
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
  }, [token, unreadCount, refresh]);

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
    if (!token || !user?.id) {
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
      if (nextState === 'active') pollUnread();
    });

    // Keep the badge/list fresh when a remote push arrives or is tapped. The
    // OS shows the banner itself; here we just reconcile in-app state.
    const removePushListeners = addNotificationListeners({
      onReceive: () => pollUnread(),
      onRespond: () => pollUnread(),
    });

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      sub.remove();
      removePushListeners();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.id]);

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
