/**
 * Header dropdown with the current account name and a sign-out button.
 * Closes on Escape, on outside-click, and after sign-out. Returns focus to
 * the trigger when the menu closes.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import styles from './UserMenu.module.scss';
import { useAuth } from './useAuth';

const initialsFor = (name: string | null, username: string): string => {
  const source = name && name.trim() ? name : username;
  const parts = source.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const UserMenu = () => {
  const { state, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const closeMenu = useCallback((options: { restoreFocus: boolean }) => {
    setOpen(false);
    if (options.restoreFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeMenu({ restoreFocus: true });
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        closeMenu({ restoreFocus: false });
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, closeMenu]);

  if (state.status !== 'authenticated') return null;

  const { account } = state;
  const initials = initialsFor(account.name, account.username);
  const displayName = account.name ?? account.username;

  return (
    <div className={styles.wrapper}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={styles.avatar} aria-hidden="true">
          {initials}
        </span>
        <span>{displayName}</span>
      </button>
      {open && (
        <div ref={menuRef} className={styles.menu} role="menu">
          <div className={styles.identity}>
            <div className={styles.identityName}>{displayName}</div>
            <div className={styles.identityUsername}>{account.username}</div>
          </div>
          <button
            type="button"
            role="menuitem"
            className={styles.signOut}
            onClick={() => {
              closeMenu({ restoreFocus: false });
              void signOut();
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
};
