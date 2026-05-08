/**
 * Header dropdown showing the current account name and a sign-out button.
 * Uses MSAL's logoutPopup so the user lands back on the consuming app.
 */

import { useCallback, useRef, useState } from 'react';

import { useMsal } from '@azure/msal-react';

import { useAuth } from './useAuth';
import styles from './UserMenu.module.css';

export const UserMenu = () => {
  const auth = useAuth();
  const { instance } = useMsal();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleSignOut = useCallback(() => {
    setOpen(false);
    void instance
      .logoutPopup({
        account: instance.getActiveAccount() ?? undefined,
      })
      .catch((error: unknown) => {
        // eslint-disable-next-line no-console
        console.error('[auth] logoutPopup failed', error);
      });
  }, [instance]);

  if (auth.status !== 'authenticated') return null;

  const label = auth.account.name ?? auth.account.username;

  return (
    <div className={styles.root}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        {label}
      </button>
      {open && (
        <div role="menu" className={styles.menu} aria-label="Account menu">
          <p className={styles.account}>
            <span className={styles.accountName}>{auth.account.name ?? '—'}</span>
            <span className={styles.accountUsername}>{auth.account.username}</span>
          </p>
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className={styles.signOut}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
};
