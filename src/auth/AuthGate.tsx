/**
 * Render-gate that shows the sign-in screen when unauthenticated and renders
 * children when authenticated. Drives MSAL `loginRedirect` per
 * REQUIREMENTS.md §3.
 *
 * The `auth/expired` indexer event is handled by the AppShell event router
 * (slice 2) — it increments a remountKey to force `<IndexerApp>` to re-acquire
 * its token. AuthGate itself surfaces the sign-in screen when MSAL reports
 * no active account, so the user can re-authenticate from there.
 */

import { useCallback, type ReactNode } from 'react';

import { useMsal } from '@azure/msal-react';

import { useAuth } from './useAuth';
import { apiScopes } from './msalConfig';
import styles from './SignInScreen.module.css';

interface Props {
  children: ReactNode;
}

export const AuthGate = ({ children }: Props) => {
  const auth = useAuth();
  const { instance } = useMsal();

  const handleSignIn = useCallback(() => {
    void instance.loginRedirect(apiScopes).catch((error: unknown) => {
      // eslint-disable-next-line no-console
      console.error('[auth] loginRedirect failed', error);
    });
  }, [instance]);

  if (auth.status === 'authenticating') {
    return (
      <div role="status" aria-live="polite" className={styles.status}>
        Signing you in…
      </div>
    );
  }

  if (auth.status === 'unauthenticated' || auth.status === 'expired') {
    return (
      <main className={styles.main} aria-labelledby="signin-heading">
        <h1 id="signin-heading" className={styles.title}>
          Sign in
        </h1>
        <p className={styles.subtitle}>
          {auth.status === 'expired'
            ? 'Your session expired. Sign in again to continue.'
            : 'Sign in with your work account to continue.'}
        </p>
        <button type="button" onClick={handleSignIn} className={styles.button}>
          Sign in with Microsoft
        </button>
      </main>
    );
  }

  return <>{children}</>;
};
