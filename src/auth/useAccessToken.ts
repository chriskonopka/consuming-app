/**
 * What belongs here: returns the canonical token-acquisition function. The
 * SAME function is passed to <IndexerApp getAccessToken={...} /> and to
 * useApiClient — never two different functions, never two MSAL instances.
 *
 * Behaviour: tries acquireTokenSilent, falls back to acquireTokenPopup on
 * InteractionRequiredAuthError. Throws on hard failure (callers handle
 * by surfacing AuthState='expired').
 *
 * Scaffolded — implementation lands in slice 1.
 */

import type { GetAccessToken } from '@shared/types';

export const useAccessToken = (): GetAccessToken => {
  return async () => {
    throw new Error(
      'useAccessToken: not implemented in scaffold — landed in slice 1 (Auth + App shell + Telemetry).',
    );
  };
};
