import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { authApi } from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    restoreSession();
  }, []);

  async function restoreSession() {
    try {
      const storedToken = await SecureStore.getItemAsync('authToken');
      const storedUser = await SecureStore.getItemAsync('authUser');
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch {
      // session restore failed silently
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    const data = await authApi.login(email, password);
    await SecureStore.setItemAsync('authToken', data.token);
    await SecureStore.setItemAsync('authUser', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data;
  }

  async function register(email, password) {
    const data = await authApi.register(email, password);
    await SecureStore.setItemAsync('authToken', data.token);
    await SecureStore.setItemAsync('authUser', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data;
  }

  async function googleSignIn(idToken) {
    const data = await authApi.google(idToken);
    await SecureStore.setItemAsync('authToken', data.token);
    await SecureStore.setItemAsync('authUser', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data;
  }

  async function appleSignIn({ identityToken, email, fullName }) {
    const data = await authApi.apple({ identityToken, email, fullName });
    await SecureStore.setItemAsync('authToken', data.token);
    await SecureStore.setItemAsync('authUser', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data;
  }

  async function clearSession() {
    await SecureStore.deleteItemAsync('authToken');
    await SecureStore.deleteItemAsync('authUser');
    setToken(null);
    setUser(null);
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
      value={{ user, token, loading, login, register, googleSignIn, appleSignIn, logout, deleteAccount }}
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
