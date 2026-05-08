/**
 * The canonical token-acquisition function. The SAME function reference is
 * passed to <IndexerApp getAccessToken={...} /> (slice 2) and to useApiClient
 * (slice 2+) — never two different functions, never two MSAL instances
 * (CLAUDE.md §"Token uniformity").
 *
 * Tries `acquireTokenSilent`. Falls back to `acquireTokenPopup` on
 * `InteractionRequiredAuthError`. Throws on hard failure — callers handle by
 * surfacing AuthState='expired' (the indexer will emit auth/expired on its
 * side; the host's expireAuth() also runs from useApiClient on a 401).
 */

import { InteractionRequiredAuthError } from '@azure/msal-browser';
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
    try {
      const result = await msalInstance.acquireTokenSilent({
        account,
        scopes: API_SCOPES,
      });
      return result.accessToken;
    } catch (err) {
      if (err instanceof InteractionRequiredAuthError) {
        const result = await msalInstance.acquireTokenPopup({ scopes: API_SCOPES });
        return result.accessToken;
      }
      throw err;
    }
  }, []);
