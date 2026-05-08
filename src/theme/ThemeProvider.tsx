/**
 * Theme React context. Reads `localStorage.theme-preference` (the only
 * sanctioned localStorage key per web-persistence.md) and toggles
 * `[data-theme]` on <html>. The first-paint synchronization happens via an
 * inline <script> in index.html, not here, to avoid a flash of wrong theme
 * (per web-performance.md).
 */

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { THEME_PREFERENCE_KEY, type Theme } from '@shared/types';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

const readInitialTheme = (): Theme => {
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'light' || attr === 'dark') return attr;
  }
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem(THEME_PREFERENCE_KEY);
      if (stored === 'light' || stored === 'dark') return stored;
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    } catch {
      /* localStorage unavailable */
    }
  }
  return 'light';
};

interface Props {
  children: ReactNode;
}

export const ThemeProvider = ({ children }: Props) => {
  const [theme, setThemeState] = useState<Theme>(readInitialTheme);

  // Keep the DOM attribute in sync with state.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(THEME_PREFERENCE_KEY, next);
    } catch {
      /* localStorage unavailable — DOM still updates via the effect above */
    }
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
