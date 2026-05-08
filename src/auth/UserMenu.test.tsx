jest.mock('./msalInstance');

import { EventType, type AccountInfo as MsalAccountInfo } from '@azure/msal-browser';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';

import { AuthContextProvider } from './AuthContext';
import { UserMenu } from './UserMenu';

const msalMock = jest.requireMock('./msalInstance');

const wait = () => act(async () => undefined);

const renderSignedIn = async (overrides?: Partial<MsalAccountInfo>) => {
  const account: Partial<MsalAccountInfo> = {
    homeAccountId: 'oid',
    name: 'Hubot Smith',
    username: 'hubot.smith@example.com',
    ...overrides,
  };
  msalMock.msalInstance.getAllAccounts.mockReturnValue([account]);
  const result = render(
    <AuthContextProvider>
      <UserMenu />
    </AuthContextProvider>,
  );
  await wait();
  return result;
};

beforeEach(() => {
  msalMock.__resetMsalMock();
});

describe('UserMenu', () => {
  it('renders nothing when unauthenticated', async () => {
    render(
      <AuthContextProvider>
        <UserMenu />
      </AuthContextProvider>,
    );
    await wait();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows the account name on the trigger button', async () => {
    await renderSignedIn();
    expect(screen.getByRole('button', { name: /Hubot Smith/ })).toBeInTheDocument();
  });

  it('toggles the menu open and closed', async () => {
    const user = userEvent.setup();
    await renderSignedIn();

    const trigger = screen.getByRole('button', { name: /Hubot Smith/ });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on Escape and restores focus to the trigger', async () => {
    const user = userEvent.setup();
    await renderSignedIn();

    const trigger = screen.getByRole('button', { name: /Hubot Smith/ });
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });

  it('closes on outside pointer-down without restoring focus', async () => {
    const user = userEvent.setup();
    await renderSignedIn();

    const trigger = screen.getByRole('button', { name: /Hubot Smith/ });
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await user.click(document.body);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('signs out via MSAL when the menu item is clicked', async () => {
    const user = userEvent.setup();
    msalMock.msalInstance.logoutPopup.mockImplementation(async () => {
      msalMock.__emitMsalEvent({ eventType: EventType.LOGOUT_SUCCESS });
    });
    await renderSignedIn();

    const trigger = screen.getByRole('button', { name: /Hubot Smith/ });
    await user.click(trigger);
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));

    expect(msalMock.msalInstance.logoutPopup).toHaveBeenCalled();
  });

  it('falls back to username initials when name is missing', async () => {
    await renderSignedIn({ name: null, username: 'hubot.smith@example.com' });
    expect(screen.getByRole('button', { name: /hubot\.smith@example\.com/ })).toBeInTheDocument();
  });

  it('renders a single-letter initial when the source has one part', async () => {
    await renderSignedIn({ name: 'Cher', username: 'cher@example.com' });
    expect(screen.getByRole('button', { name: /Cher/ })).toBeInTheDocument();
  });

  it('has no accessibility violations when closed', async () => {
    const { container } = await renderSignedIn();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no accessibility violations when open', async () => {
    const user = userEvent.setup();
    const { container } = await renderSignedIn();
    await user.click(screen.getByRole('button', { name: /Hubot Smith/ }));
    expect(await axe(container)).toHaveNoViolations();
  });
});
