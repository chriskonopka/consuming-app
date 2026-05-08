/**
 * MSAL configuration built from src/config/env.ts. The PublicClientApplication
 * is constructed once at module load time (singleton) so that MsalProvider
 * always gets the same instance even if it's re-rendered.
 *
 * Token cache: sessionStorage (per api-client-auth.md — never localStorage,
 * refresh-token leak risk).
 *
 * The Entra app reg referenced by `config.msalClientId` must be SPA-classified
 * (PKCE), not public client. See INTEGRATION.md.
 */

import {
  PublicClientApplication,
  type Configuration,
  type SilentRequest,
} from '@azure/msal-browser';

import { config } from '../config/env';

const msalConfiguration: Configuration = {
  auth: {
    clientId: config.msalClientId,
    authority: config.msalAuthority,
    redirectUri: typeof window !== 'undefined' ? `${window.location.origin}/` : '/',
  },
  cache: {
    cacheLocation: 'sessionStorage',
  },
};

export const msalInstance = new PublicClientApplication(msalConfiguration);

/** Initialize MSAL once. Idempotent — safe to call multiple times. */
let initialized: Promise<void> | null = null;
export const initializeMsal = (): Promise<void> => {
  if (!initialized) {
    initialized = msalInstance
      .initialize()
      .then(async () => {
        // Process any in-flight auth-code redirect before children render.
        await msalInstance.handleRedirectPromise();
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length > 0 && !msalInstance.getActiveAccount()) {
          msalInstance.setActiveAccount(accounts[0]);
        }
      })
      .catch((error: unknown) => {
        // eslint-disable-next-line no-console
        console.error('[auth] MSAL initialization failed', error);
      });
  }
  return initialized;
};

/** Scopes the API expects on tokens. Same audience for indexer + host calls. */
export const apiScopes: SilentRequest = {
  scopes: [config.msalApiScope],
};
