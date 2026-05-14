jest.mock('../auth/msalInstance');

import { type AccountInfo as MsalAccountInfo } from '@azure/msal-browser';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';

import { AuthContextProvider } from '../auth/AuthContext';
import { ThemeProvider } from '../theme';
import { flushIDB } from '../test-utils';

import { AppShell } from './AppShell';

const msalMock = jest.requireMock('../auth/msalInstance');

const wait = () => act(async () => undefined);

const buildQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

const renderShell = async (overrides?: { theme?: 'light' | 'dark'; route?: string }) => {
  const account: Partial<MsalAccountInfo> = {
    homeAccountId: 'oid',
    name: 'Hubot',
    username: 'hubot@example.com',
  };
  msalMock.msalInstance.getAllAccounts.mockReturnValue([account]);

  if (overrides?.theme) {
    document.documentElement.setAttribute('data-theme', overrides.theme);
  }

  const result = render(
    <AuthContextProvider>
      <QueryClientProvider client={buildQueryClient()}>
        <ThemeProvider>
          <MemoryRouter initialEntries={[overrides?.route ?? '/']}>
            <AppShell />
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </AuthContextProvider>,
  );
  await wait();
  await flushIDB();
  return result;
};

beforeEach(() => {
  msalMock.__resetMsalMock();
  document.documentElement.removeAttribute('data-theme');
  window.localStorage.clear();
});

describe('AppShell', () => {
  it('renders the brand, theme toggle, user menu, and skip-link', async () => {
    await renderShell();

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getAllByText('Bayer').length).toBeGreaterThan(0);
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /skip to main/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Switch to (light|dark) theme/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hubot/ })).toBeInTheDocument();
  });

  it('toggles theme via the header button and reflects aria-pressed', async () => {
    const user = userEvent.setup();
    await renderShell({ theme: 'light' });

    const toggle = screen.getByRole('button', { name: /Switch to dark theme/ });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await user.click(toggle);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(window.localStorage.getItem('theme-preference')).toBe('dark');
    expect(
      screen.getByRole('button', { name: /Switch to light theme/ }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('places the skip-link as the first focusable element', async () => {
    await renderShell();
    await userEvent.tab();
    expect(screen.getByRole('link', { name: /skip to main/i })).toHaveFocus();
  });

  it('focuses the main landmark when the skip-link is activated', async () => {
    await renderShell();
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(window.location.hash).toBe('#main-content');
  });

  it('user-menu is not in the DOM tree when unauthenticated', async () => {
    msalMock.msalInstance.getAllAccounts.mockReturnValue([]);
    render(
      <AuthContextProvider>
        <QueryClientProvider client={buildQueryClient()}>
          <ThemeProvider>
            <MemoryRouter>
              <AppShell />
            </MemoryRouter>
          </ThemeProvider>
        </QueryClientProvider>
      </AuthContextProvider>,
    );
    await wait();
    const header = screen.getByRole('banner');
    expect(within(header).queryByText(/Hubot/)).not.toBeInTheDocument();
  });

  it('has no accessibility violations in light theme', async () => {
    const { container } = await renderShell({ theme: 'light' });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no accessibility violations in dark theme', async () => {
    const { container } = await renderShell({ theme: 'dark' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
