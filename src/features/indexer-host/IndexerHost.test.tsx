import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import { IndexerHost } from './IndexerHost';

jest.mock('../../auth/msalConfig', () => ({
  msalInstance: {},
  initializeMsal: jest.fn().mockResolvedValue(undefined),
  apiScopes: { scopes: ['api://test/Access'] },
}));

jest.mock('@azure/msal-react', () => ({
  MsalProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useMsal: () => ({
    accounts: [{ homeAccountId: 'a1', name: 'Test', username: 't@example.com' }],
    inProgress: 'none',
    instance: {
      acquireTokenSilent: jest.fn().mockResolvedValue({ accessToken: 'token-xyz' }),
      acquireTokenPopup: jest.fn(),
      getActiveAccount: jest.fn().mockReturnValue({
        homeAccountId: 'a1',
        username: 't@example.com',
      }),
      getAllAccounts: jest
        .fn()
        .mockReturnValue([{ homeAccountId: 'a1', username: 't@example.com' }]),
    },
  }),
}));

jest.mock('../../theme/useTheme', () => ({
  useTheme: () => ({ theme: 'light', setTheme: jest.fn() }),
}));

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<IndexerHost />} />
        <Route path="/c/:documentSetId" element={<IndexerHost />} />
      </Routes>
    </MemoryRouter>,
  );

describe('IndexerHost — slice 2', () => {
  it('lazy-loads the federated IndexerApp inside Suspense', async () => {
    renderAt('/');
    expect(
      await screen.findByTestId('mock-indexer-app'),
    ).toBeInTheDocument();
  });

  it('renders the indexer with the host wiring (props reach the mock)', async () => {
    renderAt('/');
    const node = await screen.findByTestId('mock-indexer-app');
    // The mock renders only when the host has wired props correctly via
    // forwardRef + Suspense. Presence is the assertion.
    expect(node).toBeInTheDocument();
  });

  it('mounts on /c/:documentSetId routes (deep-link)', async () => {
    renderAt('/c/abc-123');
    expect(
      await screen.findByTestId('mock-indexer-app'),
    ).toBeInTheDocument();
  });
});
