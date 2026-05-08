/**
 * Wraps `@azure/msal-react`'s `MsalProvider` with our preconfigured singleton,
 * then nests the AuthContextProvider so `useAuth()` callers downstream see a
 * unified state machine. Mounted once at the app root by bootstrap.tsx.
 */

import { MsalProvider } from '@azure/msal-react';
import { type ReactNode } from 'react';

import { AuthContextProvider } from './AuthContext';
import { msalInstance } from './msalInstance';

interface Props {
  children: ReactNode;
}

export const MsalAppProvider = ({ children }: Props) => (
  <MsalProvider instance={msalInstance}>
    <AuthContextProvider>{children}</AuthContextProvider>
  </MsalProvider>
);
