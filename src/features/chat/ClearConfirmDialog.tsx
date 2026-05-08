/**
 * Confirms before deleting the conversation. Backdrop click and Escape
 * cancel.
 */

import { useEffect, useRef } from 'react';

import styles from './ClearConfirmDialog.module.css';

interface Props {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ClearConfirmDialog = ({ open, onCancel, onConfirm }: Props) => {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className={styles.backdrop}>
      <div
        className={styles.backdropClickArea}
        onClick={onCancel}
        aria-hidden="true"
      />
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="clear-title"
      >
        <h2 id="clear-title" className={styles.title}>
          Clear conversation?
        </h2>
        <p className={styles.body}>
          This will delete the current conversation. The next message starts
          a new one.
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={onCancel}>
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={styles.confirm}
            onClick={onConfirm}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
};
