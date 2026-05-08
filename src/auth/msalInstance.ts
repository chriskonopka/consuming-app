/**
 * MSAL `PublicClientApplication` singleton — created once at module load,
 * configured from build-time env vars (DefinePlugin → src/config/env.ts).
 *
 * Token cache: sessionStorage (MSAL default). Per REQUIREMENTS.md §3.5 and
 * web-persistence.md, tokens MUST NOT live in localStorage or IndexedDB.
 *
 * The instance is created exactly once. MSAL forbids re-init in the same tab,
 * and CLAUDE.md states "MSAL configuration is read-once at app boot. Do not
 * mutate `PublicClientApplication` after init."
 *
 * E2E stub: when the build is invoked with `MSAL_E2E_STUB=true`, the
 * deterministic stub from `./msalInstance.e2eStub` is exported instead.
 * The gating literal folds to `false` in production builds and Terser
 * dead-code-eliminates the branch — no stub code in shipped bundles.
 */

import { PublicClientApplication, type Configuration } from '@azure/msal-browser';

import { config } from '../config/env';

import { e2eMsalStub } from './msalInstance.e2eStub';

const msalConfig: Configuration = {
  auth: {
    clientId: config.msalClientId,
    authority: config.msalAuthority,
    redirectUri: typeof window !== 'undefined' ? window.location.origin : '/',
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
};

const useStub = process.env.MSAL_E2E_STUB === 'true';

export const msalInstance: PublicClientApplication = useStub
  ? e2eMsalStub
  : new PublicClientApplication(msalConfig);

/** Pre-initialised so callers can `await` on first use without a race. */
export const msalReady: Promise<void> = msalInstance.initialize();

/** API scope to request on every token acquisition. Single audience. */
export const API_SCOPES = [config.msalApiScope].filter(Boolean);
