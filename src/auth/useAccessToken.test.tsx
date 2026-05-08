jest.mock('./msalInstance');

import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { act, renderHook } from '@testing-library/react';

import { useAccessToken } from './useAccessToken';

const msalMock = jest.requireMock('./msalInstance');

beforeEach(() => {
  msalMock.__resetMsalMock();
});

describe('useAccessToken', () => {
  // Logic-only hook (no rendered DOM output) — no axe assertion. The token
  // path is exercised end-to-end by the AuthContext + AppShell tests.

  it('throws when no active account exists', async () => {
    const { result } = renderHook(() => useAccessToken());
    await expect(result.current()).rejects.toThrow('no_active_account');
  });

  it('returns the silent-token result on the happy path', async () => {
    msalMock.msalInstance.getActiveAccount.mockReturnValue({ homeAccountId: 'oid' });
    const { result } = renderHook(() => useAccessToken());
    await act(async () => {
      const token = await result.current();
      expect(token).toBe('mock-silent-token');
    });
    expect(msalMock.msalInstance.acquireTokenSilent).toHaveBeenCalled();
    expect(msalMock.msalInstance.acquireTokenPopup).not.toHaveBeenCalled();
  });

  it('falls back to popup on InteractionRequiredAuthError', async () => {
    msalMock.msalInstance.getActiveAccount.mockReturnValue({ homeAccountId: 'oid' });
    msalMock.msalInstance.acquireTokenSilent.mockRejectedValue(
      new InteractionRequiredAuthError('interaction_required'),
    );
    const { result } = renderHook(() => useAccessToken());
    await act(async () => {
      const token = await result.current();
      expect(token).toBe('mock-popup-token');
    });
    expect(msalMock.msalInstance.acquireTokenPopup).toHaveBeenCalled();
  });

  it('rethrows non-interaction errors', async () => {
    msalMock.msalInstance.getActiveAccount.mockReturnValue({ homeAccountId: 'oid' });
    msalMock.msalInstance.acquireTokenSilent.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useAccessToken());
    await expect(result.current()).rejects.toThrow('network');
    expect(msalMock.msalInstance.acquireTokenPopup).not.toHaveBeenCalled();
  });

  it('returns the same function reference between renders (stable identity for prop passing)', () => {
    msalMock.msalInstance.getActiveAccount.mockReturnValue({ homeAccountId: 'oid' });
    const { result, rerender } = renderHook(() => useAccessToken());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
