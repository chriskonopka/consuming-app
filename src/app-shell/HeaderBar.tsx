/**
 * Top-of-page chrome: app name (left), chat toggle + theme toggle + user
 * menu (right). Stays visible across all routes.
 */

import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from '../auth/UserMenu';
import { isAppInsightsConfigured } from '../config/env';
import styles from './HeaderBar.module.css';

const APP_NAME = 'Consuming App';

interface Props {
  chatOpen: boolean;
  onToggleChat: () => void;
}

export const HeaderBar = ({ chatOpen, onToggleChat }: Props) => {
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
        <button
          type="button"
          className={styles.chatToggle}
          onClick={onToggleChat}
          aria-pressed={chatOpen}
          aria-label={chatOpen ? 'Close chat' : 'Open chat'}
        >
          💬 Chat
        </button>
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
};
