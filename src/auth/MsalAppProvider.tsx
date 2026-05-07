/**
 * What belongs here: MSAL `PublicClientApplication` configuration and the
 * React provider that exposes it. Wraps `@azure/msal-react`'s `MsalProvider`
 * with our preconfigured instance built from `src/config/env.ts`.
 *
 * Scaffolded — implementation lands in slice 1 (App shell + Auth + Telemetry).
 */

import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

export const MsalAppProvider = ({ children }: Props) => {
  // Slice 1 wraps children in <MsalProvider instance={msalInstance}>.
  return <>{children}</>;
};
