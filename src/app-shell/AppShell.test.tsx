import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { BrowserRouter } from 'react-router-dom';

import { AppShell } from './AppShell';

jest.mock('../auth/msalConfig', () => ({
  msalInstance: {},
  initializeMsal: jest.fn().mockResolvedValue(undefined),
  apiScopes: { scopes: ['api://test/Access'] },
}));

jest.mock('@azure/msal-react', () => ({
  MsalProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useMsal: () => ({
    accounts: [],
    inProgress: 'none',
    instance: {
      loginRedirect: jest.fn().mockResolvedValue(undefined),
      logoutPopup: jest.fn().mockResolvedValue(undefined),
      getActiveAccount: jest.fn().mockReturnValue(null),
      getAllAccounts: jest.fn().mockReturnValue([]),
    },
  }),
}));

const renderWithProviders = () =>
  render(
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>,
  );

describe('AppShell — slice 1', () => {
  it('renders the sign-in screen when unauthenticated', () => {
    renderWithProviders();
    expect(
      screen.getByRole('heading', { name: /sign in/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /sign in with microsoft/i }),
    ).toBeInTheDocument();
  });

  it('does NOT render the header bar when unauthenticated', () => {
    renderWithProviders();
    // AuthGate intercepts before HeaderBar; banner role should be absent.
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  });

  it('has no accessibility violations on the sign-in screen', async () => {
    const { container } = renderWithProviders();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
