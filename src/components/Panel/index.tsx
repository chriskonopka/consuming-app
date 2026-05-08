/**
 * Slide-in panel base shared by chat (left) and viewer (right). Owns:
 *   - Focus trap while open
 *   - Focus restore to the trigger on close
 *   - Escape closes
 *   - Backdrop on mobile (and on tablet/desktop when stacked — the `<AppShell>`
 *     decides the breakpoint via the `widthPx` it passes)
 *   - Honors `prefers-reduced-motion` (no slide animation)
 *
 * The panel renders a `role="dialog"` with `aria-modal="true"`. While `open` is
 * true, focus is moved to the first focusable element inside; Tab/Shift+Tab is
 * trapped inside the dialog. When the panel closes, focus returns to the
 * element that was focused before opening (typically the trigger button).
 */

import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import styles from './Panel.module.scss';

interface Props {
  side: 'left' | 'right';
  open: boolean;
  widthPx: number;
  onClose: () => void;
  ariaLabel: string;
  children: ReactNode;
  /** Optional id used by triggers for `aria-controls`. */
  id?: string;
}

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export const Panel = ({ side, open, widthPx, onClose, ariaLabel, children, id }: Props) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<Element | null>(null);

  // Focus management — capture the previously-focused element on open, return
  // focus on close.
  useEffect(() => {
    if (!open) return undefined;
    previouslyFocusedRef.current = document.activeElement;
    const node = panelRef.current;
    if (node) {
      const firstFocusable = node.querySelector<HTMLElement>(FOCUSABLE);
      (firstFocusable ?? node).focus();
    }
    return () => {
      const previous = previouslyFocusedRef.current;
      if (previous instanceof HTMLElement) {
        previous.focus();
      }
    };
  }, [open]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const node = panelRef.current;
      if (!node) return;
      const focusables = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) =>
          element.getAttribute('aria-hidden') !== 'true' &&
          !element.hasAttribute('disabled'),
      );
      if (focusables.length === 0) {
        event.preventDefault();
        node.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  if (!open) return null;

  return (
    <>
      <div className={styles.backdrop} aria-hidden="true" onClick={onClose} />
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- modal dialog requires keydown for focus trap + Escape close */}
      <div
        ref={panelRef}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        className={`${styles.panel} ${side === 'left' ? styles.left : styles.right}`}
        style={{ width: `${widthPx}px` }}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </>
  );
};
