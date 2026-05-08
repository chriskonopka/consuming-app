jest.mock('./msalInstance');

import { EventType, type AccountInfo as MsalAccountInfo } from '@azure/msal-browser';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useContext } from 'react';

import { AuthContext, AuthContextProvider } from './AuthContext';

const msalMock = jest.requireMock('./msalInstance');

const Probe = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) return null;
  return (
    <div>
      <p data-testid="status">{ctx.state.status}</p>
      {ctx.state.status === 'authenticated' && (
        <p data-testid="username">{ctx.state.account.username}</p>
      )}
      <button type="button" onClick={() => void ctx.signIn()}>
        sign-in
      </button>
      <button type="button" onClick={() => void ctx.signOut()}>
        sign-out
      </button>
      <button type="button" onClick={ctx.expireAuth}>
        expire
      </button>
    </div>
  );
};

const wait = () => act(async () => undefined);

beforeEach(() => {
  msalMock.__resetMsalMock();
});

describe('AuthContextProvider', () => {
  it('initializes as unauthenticated when no MSAL accounts exist', async () => {
    render(
      <AuthContextProvider>
        <Probe />
      </AuthContextProvider>,
    );
    await wait();
    expect(screen.getByTestId('status').textContent).toBe('unauthenticated');
  });

  it('hydrates as authenticated when MSAL has an existing account', async () => {
    const account: Partial<MsalAccountInfo> = {
      homeAccountId: 'oid:hash',
      name: 'Hubot',
      username: 'hubot@example.com',
    };
    msalMock.msalInstance.getAllAccounts.mockReturnValue([account]);

    render(
      <AuthContextProvider>
        <Probe />
      </AuthContextProvider>,
    );
    await wait();

    expect(screen.getByTestId('status').textContent).toBe('authenticated');
    expect(screen.getByTestId('username').textContent).toBe('hubot@example.com');
    expect(msalMock.msalInstance.setActiveAccount).toHaveBeenCalledWith(account);
  });

  it('uses the active account when one is already set', async () => {
    const account: Partial<MsalAccountInfo> = {
      homeAccountId: 'oid:active',
      name: null,
      username: 'active@example.com',
    };
    msalMock.msalInstance.getActiveAccount.mockReturnValue(account);

    render(
      <AuthContextProvider>
        <Probe />
      </AuthContextProvider>,
    );
    await wait();

    expect(screen.getByTestId('username').textContent).toBe('active@example.com');
    // setActiveAccount not called when there's already one.
    expect(msalMock.msalInstance.setActiveAccount).not.toHaveBeenCalled();
  });

  it('flips to authenticating during signIn and to authenticated on success', async () => {
    const user = userEvent.setup();
    const account: Partial<MsalAccountInfo> = {
      homeAccountId: 'oid',
      name: 'Test',
      username: 'test@example.com',
    };
    msalMock.msalInstance.loginPopup.mockImplementation(async () => {
      // Simulate the LOGIN_SUCCESS event the real MSAL would emit.
      msalMock.__emitMsalEvent({
        eventType: EventType.LOGIN_SUCCESS,
        payload: { account },
      });
      return {};
    });

    render(
      <AuthContextProvider>
        <Probe />
      </AuthContextProvider>,
    );
    await wait();

    await user.click(screen.getByRole('button', { name: 'sign-in' }));

    expect(msalMock.msalInstance.loginPopup).toHaveBeenCalled();
    expect(screen.getByTestId('status').textContent).toBe('authenticated');
  });

  it('returns to unauthenticated if loginPopup throws', async () => {
    const user = userEvent.setup();
    msalMock.msalInstance.loginPopup.mockRejectedValue(new Error('user_cancelled'));

    render(
      <AuthContextProvider>
        <Probe />
      </AuthContextProvider>,
    );
    await wait();

    await user.click(screen.getByRole('button', { name: 'sign-in' }));

    expect(screen.getByTestId('status').textContent).toBe('unauthenticated');
  });

  it('signOut triggers MSAL logoutPopup and the LOGOUT_SUCCESS event flips state', async () => {
    const user = userEvent.setup();
    const account: Partial<MsalAccountInfo> = {
      homeAccountId: 'oid',
      name: 'Test',
      username: 'test@example.com',
    };
    msalMock.msalInstance.getAllAccounts.mockReturnValue([account]);
    msalMock.msalInstance.logoutPopup.mockImplementation(async () => {
      msalMock.__emitMsalEvent({ eventType: EventType.LOGOUT_SUCCESS });
    });

    render(
      <AuthContextProvider>
        <Probe />
      </AuthContextProvider>,
    );
    await wait();
    expect(screen.getByTestId('status').textContent).toBe('authenticated');

    await user.click(screen.getByRole('button', { name: 'sign-out' }));
    expect(msalMock.msalInstance.logoutPopup).toHaveBeenCalled();
    expect(screen.getByTestId('status').textContent).toBe('unauthenticated');
  });

  it('expireAuth flips state to expired (used by indexer auth/expired event in slice 2)', async () => {
    const user = userEvent.setup();
    const account: Partial<MsalAccountInfo> = {
      homeAccountId: 'oid',
      name: 'Test',
      username: 'test@example.com',
    };
    msalMock.msalInstance.getAllAccounts.mockReturnValue([account]);

    render(
      <AuthContextProvider>
        <Probe />
      </AuthContextProvider>,
    );
    await wait();

    await user.click(screen.getByRole('button', { name: 'expire' }));
    expect(screen.getByTestId('status').textContent).toBe('expired');
  });
});
