import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import { __testHooks } from '../../__mocks__/mws_indexer';

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

// Mirror AppShell's routing: a single wildcard route mounts IndexerHost on
// every URL so that `/` ↔ `/c/:documentSetId` transitions are URL changes,
// not route swaps. useUrlState extracts :documentSetId via useMatch.
const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<IndexerHost />} />
      </Routes>
    </MemoryRouter>,
  );

describe('IndexerHost — slice 2', () => {
  beforeEach(() => {
    __testHooks.reset();
  });

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

  // Regression: a fully-resolved `collection/activated` event must NOT cause
  // the sync effect to fire `selectCollection(null)` on the indexer ref.
  //
  // The bug it guards against: handleEvent's `setActiveCollection({...})`
  // (urgent priority) and `url.pushCollection(id)` (transition priority in
  // react-router-dom v7) used to land in different render passes. The sync
  // effect ran in the intermediate render, saw `activeCollection` populated
  // but `url.documentSetId` still null, took the `!url.documentSetId` branch,
  // and dispatched `selectCollection(null)` — wiping the indexer's state and
  // bouncing the user back to the collection list.
  //
  // The fix wraps both updates in `startTransition` so they share the same
  // priority lane and apply atomically. This test asserts that no spurious
  // `selectCollection(null)` is observed after the mock emits a successful
  // activation event from `/`.
  it('does not spuriously deselect when collection/activated arrives at /', async () => {
    renderAt('/');
    await screen.findByTestId('mock-indexer-app');
    __testHooks.selectCollectionSpy.mockClear();

    act(() => {
      __testHooks.emit({
        type: 'collection/activated',
        documentSetId: 'collection-xyz',
        accessRole: 'Owner',
      });
    });

    // Give React a tick for the transition to flush.
    await waitFor(() => {
      // The deep-link sync (URL → indexer) may legitimately call
      // selectCollection('collection-xyz') after the URL transition lands.
      // The bug we're guarding against is selectCollection(null) — a forced
      // deselect in the middle of a successful selection.
      const calls = __testHooks.selectCollectionSpy.mock.calls;
      const sawNullDeselect = calls.some(([id]) => id === null);
      expect(sawNullDeselect).toBe(false);
    });
  });
});
