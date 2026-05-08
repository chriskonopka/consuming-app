/**
 * MSAL provider wrapper. Exposes the singleton PublicClientApplication via
 * `@azure/msal-react`'s `MsalProvider` so children can call `useMsal()`,
 * `useAccount()`, etc.
 *
 * Initialization is awaited once at module load (initializeMsal). Children
 * render immediately — useAuth() reflects whichever state MSAL is in.
 */

import { useEffect, useState, type ReactNode } from 'react';

import { MsalProvider } from '@azure/msal-react';

import { initializeMsal, msalInstance } from './msalConfig';

interface Props {
  children: ReactNode;
}

export const MsalAppProvider = ({ children }: Props) => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void initializeMsal().finally(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div role="status" aria-live="polite" aria-label="Initializing authentication">
        Loading…
      </div>
    );
  }

  return <MsalProvider instance={msalInstance}>{children}</MsalProvider>;
};
