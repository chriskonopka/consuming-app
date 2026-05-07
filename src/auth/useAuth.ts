/**
 * What belongs here: returns the current `AuthState` (subscribed to MSAL
 * account changes via the auth context).
 *
 * Scaffolded — implementation lands in slice 1.
 */

import type { AuthState } from '@shared/types';

export const useAuth = (): AuthState => {
  return { status: 'unauthenticated' };
};
