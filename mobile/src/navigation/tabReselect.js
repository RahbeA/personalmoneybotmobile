import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { DeviceEventEmitter } from 'react-native';

export const TAB_RESELECT_EVENT = 'tabReselect';

export const TAB_ROOT_SCREENS = {
  HomeTab: 'Home',
  MoneyverseTab: 'Moneyverse',
  FeedTab: 'Feed',
  SocialTab: 'Friends',
  TutorTab: 'Tutor',
  SettingsTab: 'SettingsTab',
};

const TabReselectContext = createContext(null);

export function emitTabReselect(routeName, extra = {}) {
  DeviceEventEmitter.emit(TAB_RESELECT_EVENT, {
    routeName,
    screen: extra.screen ?? TAB_ROOT_SCREENS[routeName],
    ...extra,
  });
}

export function TabReselectProvider({ children }) {
  const listenersRef = useRef(new Set());

  const emit = useCallback((routeName, extra = {}) => {
    const payload = {
      routeName,
      screen: extra.screen ?? TAB_ROOT_SCREENS[routeName],
      ...extra,
    };
    DeviceEventEmitter.emit(TAB_RESELECT_EVENT, payload);
    listenersRef.current.forEach((fn) => fn(payload));
  }, []);

  const subscribe = useCallback((fn) => {
    listenersRef.current.add(fn);
    return () => listenersRef.current.delete(fn);
  }, []);

  const value = useMemo(() => ({ emit, subscribe }), [emit, subscribe]);
  return (
    <TabReselectContext.Provider value={value}>
      {children}
    </TabReselectContext.Provider>
  );
}

export function useTabReselectContext() {
  return useContext(TabReselectContext);
}

/**
 * Listen for a re-tap of the already-selected tab.
 * `name` may be a tab key (`HomeTab`) or root screen (`Home`).
 */
export function useTabReselect(name, onReselect) {
  const ctx = useContext(TabReselectContext);

  useEffect(() => {
    if (!onReselect) return undefined;

    const handler = (payload) => {
      if (
        name
        && payload?.routeName !== name
        && payload?.screen !== name
      ) return;
      onReselect(payload);
    };

    if (ctx?.subscribe) {
      return ctx.subscribe(handler);
    }

    const sub = DeviceEventEmitter.addListener(TAB_RESELECT_EVENT, handler);
    return () => sub.remove();
  }, [ctx, name, onReselect]);
}
