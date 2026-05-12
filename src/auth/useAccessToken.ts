/**
 * The canonical token-acquisition function. The SAME function reference is
 * passed to <IndexerApp getAccessToken={...} /> (slice 2) and to useApiClient
 * (slice 2+) — never two different functions, never two MSAL instances
 * (CLAUDE.md §"Token uniformity").
 *
 * Tries `acquireTokenSilent`. On `InteractionRequiredAuthError` (or any other
 * silent-acquisition failure), throws the error rather than falling back to
 * `acquireTokenPopup` — popup-based token refresh is unreliable in modern
 * Chrome because the popup→parent message round-trip fails when
 * third-party-cookie isolation is on (the same bug that drove the
 * loginPopup→loginRedirect switch in AuthContext on 2026-05-11). Callers
 * handle by surfacing `AuthState='expired'`: useApiClient calls
 * `expireAuth()` on a 401, the indexer emits `auth/expired`, the AuthGate
 * shows "Your session expired" and the user re-authenticates via the
 * top-level redirect flow.
 */

import { useCallback } from 'react';

import type { GetAccessToken } from '@shared/types';

import { API_SCOPES, msalInstance, msalReady } from './msalInstance';

export const useAccessToken = (): GetAccessToken =>
  useCallback(async () => {
    await msalReady;
    const account = msalInstance.getActiveAccount();
    if (!account) {
      throw new Error('no_active_account');
    }
    const result = await msalInstance.acquireTokenSilent({
      account,
      scopes: API_SCOPES,
    });
    return result.accessToken;
  }, []);
