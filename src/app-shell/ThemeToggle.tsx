/**
 * Light / dark toggle button. Updates the DOM attribute and persists to
 * localStorage via the theme context.
 */

import { useTheme } from '../theme/useTheme';
import styles from './ThemeToggle.module.css';

export const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      className={styles.button}
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme (currently ${theme})`}
      aria-pressed={theme === 'dark'}
    >
      {theme === 'dark' ? '☾' : '☀'}
    </button>
  );
};
