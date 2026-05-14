/**
 * Render-gate: shows the branded sign-in screen when not authenticated, and
 * renders children (the app shell) when authenticated. The `expired` status
 * shows the same screen with a non-blocking notice — re-auth recovers.
 *
 * Intentionally minimal: a card with title, one CTA, and an inline error.
 * No marketing copy. Slice 1 ships this; product can replace later.
 */

import { type ReactNode } from 'react';

import styles from './AuthGate.module.scss';
import { useAuth } from './useAuth';

interface Props {
  children: ReactNode;
}

export const AuthGate = ({ children }: Props) => {
  const { state, signIn } = useAuth();

  if (state.status === 'authenticated') {
    return <>{children}</>;
  }

  const isAuthenticating = state.status === 'authenticating';
  const isExpired = state.status === 'expired';

  return (
    <main className={styles.gate} aria-labelledby="signin-title">
      <div className={styles.card}>
        <h1 id="signin-title" className={styles.title}>
          Bayer
        </h1>
        <p className={styles.subtitle}>
          Sign in with your work account to browse collections and ask questions.
        </p>
        <button
          type="button"
          className={styles.button}
          onClick={() => {
            void signIn();
          }}
          disabled={isAuthenticating}
        >
          {isAuthenticating ? 'Signing in…' : 'Sign in'}
        </button>
        {isExpired && (
          <p className={styles.expired} role="status">
            Your session expired. Sign in again to continue.
          </p>
        )}
      </div>
    </main>
  );
};
