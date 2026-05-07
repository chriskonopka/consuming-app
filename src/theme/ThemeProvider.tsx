/**
 * What belongs here: theme React context. Reads `localStorage.theme-preference`
 * (the only sanctioned localStorage key per web-persistence.md) and toggles
 * `[data-theme]` on <html>. The first-paint synchronization happens via an
 * inline <script> in index.html, not here, to avoid a flash of wrong theme
 * (per web-performance.md).
 *
 * Scaffolded — implementation lands in slice 1.
 */

import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

export const ThemeProvider = ({ children }: Props) => {
  return <>{children}</>;
};
