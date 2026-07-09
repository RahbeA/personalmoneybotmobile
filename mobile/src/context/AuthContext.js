import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
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

      try {
        const profile = await authApi.getProfile(storedToken);
        await SecureStore.setItemAsync('profileLastValidatedAt', String(Date.now()));
        await SecureStore.setItemAsync('authUser', JSON.stringify(profile));
        setToken(storedToken);
        setUser(profile);
      } catch {
        await clearSession();
      }
    } catch {
      await clearSession();
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    const data = await authApi.login(email, password);
    await persistSession(data);
    return data;
  }

  async function register(email, password, name) {
    const data = await authApi.register(email, password, name);
    await persistSession(data);
    return data;
  }

  async function googleSignIn(idToken) {
    const data = await authApi.google(idToken);
    await persistSession(data);
    return data;
  }

  async function appleSignIn({ identityToken, email, fullName }) {
    const data = await authApi.apple({ identityToken, email, fullName });
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
      value={{ user, token, loading, login, register, googleSignIn, appleSignIn, updateProfile, logout, deleteAccount }}
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
