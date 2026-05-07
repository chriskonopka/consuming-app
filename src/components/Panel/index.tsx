/**
 * What belongs here: slide-in panel base shared by chat and viewer. Focus
 * trap, focus restore on close, Escape closes, backdrop on mobile, honors
 * `prefers-reduced-motion` (no slide animation).
 *
 * Scaffolded — implementation lands in slice 3.
 */

import type { ReactNode } from 'react';

interface Props {
  side: 'left' | 'right';
  open: boolean;
  widthPx: number;
  onClose: () => void;
  ariaLabel: string;
  children: ReactNode;
}

export const Panel = ({ open, ariaLabel, children }: Props) => {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={ariaLabel}>
      {children}
    </div>
  );
};
