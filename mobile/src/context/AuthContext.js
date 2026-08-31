import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import { authApi } from '../api/auth';
import { setUnauthorizedHandler } from '../api/client';
import { clearAllApiCache } from '../utils/apiCache';
import { persistOnboardingCompleted } from '../utils/onboardingStore';

const AuthContext = createContext(null);

const PROFILE_VALID_MS = 30 * 60 * 1000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const clearSession = useCallback(async () => {
    let userId = null;
    try {
      const storedUser = await SecureStore.getItemAsync('authUser');
      if (storedUser) userId = JSON.parse(storedUser)?.id;
    } catch {
      // ignore parse errors
    }

    await SecureStore.deleteItemAsync('authToken');
    await SecureStore.deleteItemAsync('authUser');
    await SecureStore.deleteItemAsync('profileLastValidatedAt');
    await clearAllApiCache();
    if (userId) await persistOnboardingCompleted(userId, false);
    setToken(null);
    setUser(null);
  }, []);

  // A 401 from any endpoint used to log the user out instantly. Because our DRF
  // tokens never expire, a genuine 401 only happens if the token was actually
  // revoked — but a flaky proxy/network can also surface a one-off 401. So we
  // confirm with a silent profile check before nuking the session, and only
  // clear when that check *also* comes back 401. Anything else (offline, 5xx,
  // timeout) leaves the user signed in.
  const verifyingRef = useRef(false);
  useEffect(() => {
    setUnauthorizedHandler(async () => {
      if (verifyingRef.current) return;
      const storedToken = await SecureStore.getItemAsync('authToken');
      if (!storedToken) return;
      verifyingRef.current = true;
      try {
        await authApi.getProfile(storedToken, { skipUnauthorizedHandler: true });
        // Token is still valid — the earlier 401 was a fluke. Keep the session.
      } catch (e) {
        if (e?.status === 401) await clearSession();
      } finally {
        verifyingRef.current = false;
      }
    });
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  useEffect(() => {
    restoreSession();
  }, []);

  async function persistSession(data) {
    await SecureStore.setItemAsync('authToken', data.token);
    await SecureStore.setItemAsync('authUser', JSON.stringify(data.user));
    await SecureStore.setItemAsync('profileLastValidatedAt', String(Date.now()));
    setToken(data.token);
    setUser(data.user);
  }

  async function restoreSession() {
    try {
      const storedToken = await SecureStore.getItemAsync('authToken');
      const storedUser = await SecureStore.getItemAsync('authUser');
      if (!storedToken || !storedUser) return;

      const lastValidated = await SecureStore.getItemAsync('profileLastValidatedAt');
      const recentlyValidated = lastValidated
        && Date.now() - Number(lastValidated) < PROFILE_VALID_MS;

      if (recentlyValidated) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        return;
      }

      // Optimistically restore from the cached user first so a slow or offline
      // network never blocks (or drops) the session on launch.
      setToken(storedToken);
      setUser(JSON.parse(storedUser));

      try {
        const profile = await authApi.getProfile(storedToken, { skipUnauthorizedHandler: true });
        await SecureStore.setItemAsync('profileLastValidatedAt', String(Date.now()));
        await SecureStore.setItemAsync('authUser', JSON.stringify(profile));
        setToken(storedToken);
        setUser(profile);
      } catch (e) {
        // Only a real 401 means the token was revoked — then sign out. Network
        // errors, timeouts and 5xx keep the user signed in with cached data.
        if (e?.status === 401) await clearSession();
      }
    } catch {
      // SecureStore read failed — leave whatever we have; don't force a logout.
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    const data = await authApi.login(email, password);
    await persistSession(data);
    return data;
  }

  async function guestSignIn() {
    const data = await authApi.guest();
    await persistSession(data);
    return data;
  }

  // When the current session is an anonymous guest, pass its token so the
  // backend upgrades that same account in place (keeping the guest's progress).
  const upgradeToken = () => (user?.is_guest ? token : undefined);

  async function register(email, password, name) {
    const data = await authApi.register(email, password, name, upgradeToken());
    await persistSession(data);
    return data;
  }

  async function googleSignIn(idToken) {
    const data = await authApi.google(idToken, upgradeToken());
    await persistSession(data);
    return data;
  }

  async function appleSignIn({ identityToken, email, fullName }) {
    const data = await authApi.apple(
      { identityToken, email, fullName },
      upgradeToken(),
    );
    await persistSession(data);
    return data;
  }

  async function updateProfile(fields) {
    if (!token) throw new Error('You must be signed in.');
    const updated = await authApi.updateProfile(token, fields);
    await SecureStore.setItemAsync('authUser', JSON.stringify(updated));
    setUser(updated);
    return updated;
  }

  async function logout() {
    try {
      if (token) {
        await authApi.logout(token);
      }
    } catch {
      // logout API call is best-effort
    } finally {
      await clearSession();
    }
  }

  async function deleteAccount() {
    if (!token) {
      throw new Error('You must be signed in to delete your account.');
    }
    await authApi.deleteAccount(token);
    await clearSession();
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isGuest: !!user?.is_guest,
        login,
        register,
        guestSignIn,
        googleSignIn,
        appleSignIn,
        updateProfile,
        logout,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
