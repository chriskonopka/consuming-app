jest.mock('./msalInstance');

import { EventType, type AccountInfo as MsalAccountInfo } from '@azure/msal-browser';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { useContext } from 'react';

import { AuthContext, AuthContextProvider } from './AuthContext';
import { AuthGate } from './AuthGate';

const msalMock = jest.requireMock('./msalInstance');

const wait = () => act(async () => undefined);

beforeEach(() => {
  msalMock.__resetMsalMock();
});

describe('AuthGate', () => {
  it('renders the sign-in screen when unauthenticated', async () => {
    render(
      <AuthContextProvider>
        <AuthGate>
          <p>secret content</p>
        </AuthGate>
      </AuthContextProvider>,
    );
    await wait();
    expect(screen.getByRole('heading', { name: 'Ask your collections' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
  });

  it('renders children when authenticated', async () => {
    const account: Partial<MsalAccountInfo> = {
      homeAccountId: 'oid',
      name: 'Hubot',
      username: 'hubot@example.com',
    };
    msalMock.msalInstance.getAllAccounts.mockReturnValue([account]);

    render(
      <AuthContextProvider>
        <AuthGate>
          <p>secret content</p>
        </AuthGate>
      </AuthContextProvider>,
    );
    await wait();

    expect(screen.getByText('secret content')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();
  });

  it('shows the expired notice after expireAuth', async () => {
    const ExpireBtn = () => {
      // Reach into AuthContext directly to trigger the expired transition,
      // simulating slice 2's indexer auth/expired event.
      const ctx = useContext(AuthContext);
      if (!ctx) return null;
      return (
        <button type="button" onClick={ctx.expireAuth}>
          force-expire
        </button>
      );
    };

    const user = userEvent.setup();
    render(
      <AuthContextProvider>
        <ExpireBtn />
        <AuthGate>
          <p>secret content</p>
        </AuthGate>
      </AuthContextProvider>,
    );
    await wait();

    await user.click(screen.getByRole('button', { name: 'force-expire' }));
    expect(screen.getByRole('status')).toHaveTextContent(/session expired/i);
  });

  it('disables the button while authenticating', async () => {
    const user = userEvent.setup();
    let resolveLogin: () => void = () => {};
    // Production calls loginRedirect (popup flow was retired 2026-05-11 — see
    // auth/AuthContext.tsx header). The mock yields a pending promise so we
    // can assert the "Signing in…" disabled state before the auth resolves.
    msalMock.msalInstance.loginRedirect.mockImplementation(
      () =>
        new Promise<unknown>((resolve) => {
          resolveLogin = () => resolve(undefined);
        }),
    );

    render(
      <AuthContextProvider>
        <AuthGate>
          <p>secret content</p>
        </AuthGate>
      </AuthContextProvider>,
    );
    await wait();

    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    const button = screen.getByRole('button', { name: 'Signing in…' });
    expect(button).toBeDisabled();

    // Drive completion so the promise doesn't leak.
    msalMock.__emitMsalEvent({
      eventType: EventType.LOGIN_SUCCESS,
      payload: { account: { homeAccountId: 'oid', name: null, username: 'x@y' } },
    });
    await act(async () => {
      resolveLogin();
    });
  });

  it('has no accessibility violations in the sign-in state', async () => {
    const { container } = render(
      <AuthContextProvider>
        <AuthGate>
          <p>secret</p>
        </AuthGate>
      </AuthContextProvider>,
    );
    await wait();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no accessibility violations in the expired state', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const ExpireBtn = () => {
      const ctx = useContext(AuthContext);
      if (!ctx) return null;
      return (
        <button type="button" onClick={ctx.expireAuth}>
          force-expire
        </button>
      );
    };
    const user = userEvent.setup();
    const { container } = render(
      <AuthContextProvider>
        <ExpireBtn />
        <AuthGate>
          <p>secret</p>
        </AuthGate>
      </AuthContextProvider>,
    );
    await wait();
    await user.click(screen.getByRole('button', { name: 'force-expire' }));
    expect(await axe(container)).toHaveNoViolations();
    errorSpy.mockRestore();
  });

  it('has no accessibility violations in the authenticated pass-through state', async () => {
    msalMock.msalInstance.getAllAccounts.mockReturnValue([
      { homeAccountId: 'oid', name: 'Hubot', username: 'hubot@example.com' },
    ]);
    const { container } = render(
      <AuthContextProvider>
        <AuthGate>
          <main>
            <h1>signed in</h1>
          </main>
        </AuthGate>
      </AuthContextProvider>,
    );
    await wait();
    expect(await axe(container)).toHaveNoViolations();
  });
});
