/**
 * Returns the canonical token-acquisition function. The SAME function is
 * passed to <IndexerApp getAccessToken={...} /> (slice 2) and to useApiClient
 * (slice 2+) — never two different functions, never two MSAL instances.
 *
 * Behaviour: tries acquireTokenSilent, falls back to acquireTokenPopup on
 * InteractionRequiredAuthError. Throws on hard failure (callers handle by
 * surfacing AuthState='expired').
 */

import { useCallback } from 'react';

import {
  InteractionRequiredAuthError,
  type AuthenticationResult,
} from '@azure/msal-browser';
import { useMsal } from '@azure/msal-react';

import type { GetAccessToken } from '@shared/types';

import { apiScopes } from './msalConfig';

export const useAccessToken = (): GetAccessToken => {
  const { instance } = useMsal();

  return useCallback(async (): Promise<string> => {
    const account = instance.getActiveAccount() ?? instance.getAllAccounts()[0];
    if (!account) {
      throw new Error('No signed-in account; cannot acquire token.');
    }

    let result: AuthenticationResult;
    try {
      result = await instance.acquireTokenSilent({ ...apiScopes, account });
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        result = await instance.acquireTokenPopup(apiScopes);
      } else {
        throw error;
      }
    }
    return result.accessToken;
  }, [instance]);
};
