/**
 * Returns the current theme + a setter that updates the DOM attribute and
 * persists to localStorage.
 */

import { useContext } from 'react';

import type { Theme } from '@shared/types';

import { ThemeContext } from './ThemeProvider';

interface UseThemeReturn {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useTheme = (): UseThemeReturn => {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('useTheme must be used within <ThemeProvider>.');
  }
  return value;
};
