/**
 * Returns the current `AuthState`, derived from MSAL's account state.
 */

import { InteractionStatus } from '@azure/msal-browser';
import { useMsal } from '@azure/msal-react';

import type { AccountInfo, AuthState } from '@shared/types';

export const useAuth = (): AuthState => {
  const { accounts, inProgress } = useMsal();

  if (inProgress !== InteractionStatus.None && accounts.length === 0) {
    return { status: 'authenticating' };
  }

  if (accounts.length === 0) {
    return { status: 'unauthenticated' };
  }

  const msalAccount = accounts[0];
  const account: AccountInfo = {
    homeAccountId: msalAccount.homeAccountId,
    name: msalAccount.name ?? null,
    username: msalAccount.username,
  };
  return { status: 'authenticated', account };
};
