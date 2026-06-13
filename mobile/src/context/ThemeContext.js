import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { themes, darkColors } from '../theme/colors';

const STORAGE_KEY = 'themePreference';
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('dark');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(STORAGE_KEY);
        if (stored === 'light' || stored === 'dark') {
          setThemeState(stored);
        }
      } catch {
        // ignore — fall back to default dark theme
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  async function setTheme(next) {
    setThemeState(next);
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, next);
    } catch {
      // best-effort persistence
    }
  }

  function toggleTheme() {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }

  const colors = themes[theme] || darkColors;
  const isDark = theme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, colors, isDark, hydrated, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
