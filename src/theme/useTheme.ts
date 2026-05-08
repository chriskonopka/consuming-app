/**
 * Returns the current theme + a setter that updates the DOM attribute and
 * persists to localStorage. Must be called inside `<ThemeProvider>`.
 */

import { useContext } from 'react';

import { ThemeContext } from './ThemeProvider';

export const useTheme = () => {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('useTheme must be called inside <ThemeProvider>');
  }
  return value;
};
