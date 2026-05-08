/**
 * Confirmation dialog for the Clear button. Modal `<dialog>`-style markup
 * implemented as a focus-trapped div (we already use the same pattern in
 * `<Panel>`; lifting it to a hook is a future refactor when more modals
 * appear — see shared-inventory.md "intentionally not in this inventory").
 */

import { useEffect, useRef, type KeyboardEvent } from 'react';

import styles from './ClearConfirmDialog.module.scss';

interface Props {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  pending: boolean;
}

export const ClearConfirmDialog = ({ open, onConfirm, onCancel, pending }: Props) => {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      cancelRef.current?.focus();
    }
  }, [open]);

  if (!open) return null;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && !pending) {
      event.stopPropagation();
      onCancel();
    }
  };

  return (
    <div className={styles.backdrop} aria-hidden="false">
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- alertdialog uses keydown to handle Escape close */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="clear-dialog-title"
        aria-describedby="clear-dialog-body"
        className={styles.dialog}
        onKeyDown={handleKeyDown}
      >
        <h2 id="clear-dialog-title" className={styles.title}>
          Clear conversation?
        </h2>
        <p id="clear-dialog-body" className={styles.body}>
          This deletes the conversation. The next message starts a new one.
        </p>
        <div className={styles.actions}>
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={pending}
            className={styles.cancel}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={styles.confirm}
          >
            {pending ? 'Clearing…' : 'Clear'}
          </button>
        </div>
      </div>
    </div>
  );
};
