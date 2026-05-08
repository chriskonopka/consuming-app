/**
 * Top-of-page chrome: app name (left), theme toggle + user menu (right).
 * Stays visible across all routes.
 */

import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from '../auth/UserMenu';
import { isAppInsightsConfigured } from '../config/env';
import styles from './HeaderBar.module.css';

const APP_NAME = 'Consuming App';

export const HeaderBar = () => {
  const aiOk = isAppInsightsConfigured();

  return (
    <header className={styles.header} role="banner">
      <h1 className={styles.title}>{APP_NAME}</h1>
      <div className={styles.controls}>
        {!aiOk && (
          <span className={styles.aiWarning} title="App Insights not configured">
            telemetry off
          </span>
        )}
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
};
