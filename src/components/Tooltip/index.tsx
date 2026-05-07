/**
 * What belongs here: ARIA-described-by tooltip. Show on hover and keyboard
 * focus, dismiss on Escape.
 *
 * Scaffolded — implementation lands in slice 4 (used by citation markers)
 * and slice 5 (truncated text).
 */

import type { ReactElement, ReactNode } from 'react';

interface Props {
  content: ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  children: ReactElement;
}

export const Tooltip = ({ children }: Props): ReactElement => {
  return children;
};
