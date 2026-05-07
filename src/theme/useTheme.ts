/**
 * What belongs here: returns the current theme + a setter that updates the
 * DOM attribute and persists to localStorage.
 *
 * Scaffolded — implementation lands in slice 1.
 */

import type { Theme } from '@shared/types';

interface UseThemeReturn {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useTheme = (): UseThemeReturn => {
  return {
    theme: 'light',
    setTheme: () => {
      // slice 1
    },
  };
};
