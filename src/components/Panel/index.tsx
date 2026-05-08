/**
 * Slide-in panel base shared by chat (and viewer in slice 4). Honors
 * `prefers-reduced-motion`. Escape closes. Focus is restored to the
 * triggering element on close.
 */

import {
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react';

import styles from './Panel.module.css';

interface Props {
  side: 'left' | 'right';
  open: boolean;
  widthPx: number;
  onClose: () => void;
  ariaLabel: string;
  children: ReactNode;
}

export const Panel = ({ side, open, widthPx, onClose, ariaLabel, children }: Props) => {
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Save the previously-focused element when opening; restore on close.
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      // Move focus into the panel for screen-reader announcement.
      panelRef.current?.focus();
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const style: CSSProperties = {
    width: `${widthPx}px`,
    [side === 'left' ? 'left' : 'right']: 0,
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label={ariaLabel}
      tabIndex={-1}
      className={`${styles.panel} ${side === 'left' ? styles.left : styles.right}`}
      style={style}
    >
      {children}
    </div>
  );
};
