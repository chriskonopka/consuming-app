/**
 * Theme React context. Reads the current `[data-theme]` attribute set by the
 * inline `<script>` in `index.html` (so the first render matches what the
 * browser already painted), and writes back to both the DOM and
 * `localStorage.theme-preference` on every change.
 *
 * The first-paint sync happens via the inline script — never a `useEffect` —
 * to avoid a flash of wrong theme (per web-performance.md).
 */

import { createContext, useCallback, useMemo, useState, type ReactNode } from 'react';

import type { Theme } from '@shared/types';
import { THEME_PREFERENCE_KEY } from '@shared/types';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (next: Theme) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

const readInitialTheme = (): Theme => {
  if (typeof document === 'undefined') return 'light';
  const attribute = document.documentElement.getAttribute('data-theme');
  return attribute === 'dark' ? 'dark' : 'light';
};

interface Props {
  children: ReactNode;
}

export const ThemeProvider = ({ children }: Props) => {
  const [theme, setThemeState] = useState<Theme>(readInitialTheme);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', next);
    }
    try {
      window.localStorage.setItem(THEME_PREFERENCE_KEY, next);
    } catch {
      // Storage unavailable (private mode / quota). DOM still updates.
    }
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
