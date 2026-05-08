/**
 * AuthContext — owns AuthState. Bridges MSAL account events to the rest of
 * the app via a discriminated union (per data-model.md §2.1).
 *
 * Exposes:
 *   - state: the current AuthState
 *   - signIn / signOut: MSAL popup flows
 *   - expireAuth: triggered by the indexer's `auth/expired` event in slice 2
 *
 * Internal only — surface via `useAuth()` from this module. Other modules do
 * not import from this file directly.
 */

import {
  EventType,
  type AccountInfo as MsalAccountInfo,
  type EventMessage,
} from '@azure/msal-browser';
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';

import type { AccountInfo, AuthState } from '@shared/types';

import { appInsights } from '../appInsights';

import { API_SCOPES, msalInstance, msalReady } from './msalInstance';

type AuthAction =
  | { type: 'AUTHENTICATING' }
  | { type: 'AUTHENTICATED'; account: AccountInfo }
  | { type: 'UNAUTHENTICATED' }
  | { type: 'EXPIRED' };

const reducer = (_state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'AUTHENTICATING':
      return { status: 'authenticating' };
    case 'AUTHENTICATED':
      return { status: 'authenticated', account: action.account };
    case 'UNAUTHENTICATED':
      return { status: 'unauthenticated' };
    case 'EXPIRED':
      return { status: 'expired' };
  }
};

const toAccountInfo = (msal: MsalAccountInfo): AccountInfo => ({
  homeAccountId: msal.homeAccountId,
  name: msal.name ?? null,
  username: msal.username,
});

interface AuthContextValue {
  state: AuthState;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  expireAuth: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

interface Props {
  children: ReactNode;
}

export const AuthContextProvider = ({ children }: Props) => {
  const [state, dispatch] = useReducer(reducer, { status: 'unauthenticated' });

  useEffect(() => {
    let cancelled = false;
    msalReady
      .then(() => {
        if (cancelled) return;
        const active = msalInstance.getActiveAccount();
        if (active) {
          dispatch({ type: 'AUTHENTICATED', account: toAccountInfo(active) });
          return;
        }
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length > 0) {
          msalInstance.setActiveAccount(accounts[0]);
          dispatch({ type: 'AUTHENTICATED', account: toAccountInfo(accounts[0]) });
        }
      })
      .catch((err: unknown) => {
        appInsights?.trackException({
          exception: err instanceof Error ? err : new Error('msal_init_failed'),
        });
      });

    const callbackId = msalInstance.addEventCallback((message: EventMessage) => {
      if (
        message.eventType === EventType.LOGIN_SUCCESS &&
        message.payload &&
        'account' in message.payload &&
        message.payload.account
      ) {
        // EventMessage.payload is typed as `EventPayload | null`, a union too
        // wide for `account` access; we've already narrowed via `'account' in
        // payload` and the truthy check, so the cast is safe.
        const account = message.payload.account as MsalAccountInfo;
        msalInstance.setActiveAccount(account);
        dispatch({ type: 'AUTHENTICATED', account: toAccountInfo(account) });
      }
      if (message.eventType === EventType.LOGOUT_SUCCESS) {
        msalInstance.setActiveAccount(null);
        dispatch({ type: 'UNAUTHENTICATED' });
      }
    });

    return () => {
      cancelled = true;
      if (callbackId) msalInstance.removeEventCallback(callbackId);
    };
  }, []);

  const signIn = useCallback(async () => {
    dispatch({ type: 'AUTHENTICATING' });
    try {
      await msalReady;
      await msalInstance.loginPopup({ scopes: API_SCOPES });
      // The LOGIN_SUCCESS event handler dispatches AUTHENTICATED.
    } catch (err) {
      dispatch({ type: 'UNAUTHENTICATED' });
      appInsights?.trackException({
        exception: err instanceof Error ? err : new Error('login_failed'),
      });
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await msalReady;
      await msalInstance.logoutPopup();
    } catch (err) {
      appInsights?.trackException({
        exception: err instanceof Error ? err : new Error('logout_failed'),
      });
    }
  }, []);

  const expireAuth = useCallback(() => {
    dispatch({ type: 'EXPIRED' });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ state, signIn, signOut, expireAuth }),
    [state, signIn, signOut, expireAuth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
