/**
 * What belongs here: render-gate that shows the sign-in screen when
 * unauthenticated and renders children when authenticated. Drives MSAL
 * popup login and handles the `auth/expired` indexer event.
 *
 * Scaffolded — implementation lands in slice 1.
 */

import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

export const AuthGate = ({ children }: Props) => {
  // Slice 1 returns the sign-in screen for unauthenticated state.
  return <>{children}</>;
};
