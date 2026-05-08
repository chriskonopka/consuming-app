/**
 * Returns the current AuthState plus action callbacks. Subscribes to the
 * AuthContext established by `<MsalAppProvider>` at the app root.
 *
 * Throws if called outside the provider — that's a programming error, not a
 * runtime condition we recover from.
 */

import { useContext } from 'react';

import { AuthContext } from './AuthContext';

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be called inside <MsalAppProvider>');
  }
  return value;
};
