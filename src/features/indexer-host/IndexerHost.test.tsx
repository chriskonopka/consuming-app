jest.mock('../../auth/msalInstance');
jest.mock('./loadIndexerApp');
jest.mock('../../config/env', () => ({
  config: {
    apiBaseUrl: 'https://api.test',
    indexerRemoteUrl: 'http://localhost:9998',
    msalClientId: 'cid',
    msalAuthority: 'auth',
    msalApiScope: 'scope',
    appInsightsConnectionString: '',
  },
}));

import { axe } from 'jest-axe';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { MsalAppProvider } from '../../auth/MsalAppProvider';
import { ViewerProvider, useViewer } from '../viewer';
import { IndexerHost } from './IndexerHost';
import { useActiveCollection } from './IndexerHostContext';
import { useAuth } from '../../auth/useAuth';

const renderWith = (initialPath: string) => {
  // Show the active collection, auth status, and the viewer's open documentId
  // alongside the indexer so tests can assert the host's state without
  // inspecting internals.
  const Probe = () => {
    const collection = useActiveCollection();
    const { state } = useAuth();
    const viewer = useViewer();
    const location = useLocation();
    return (
      <>
        <p data-testid="active-collection">
          {collection?.documentSetId ?? 'none'}
        </p>
        <p data-testid="auth-status">{state.status}</p>
        <p data-testid="path">{location.pathname}</p>
        <p data-testid="viewer-open-id">
          {viewer.state.open?.documentId ?? 'none'}
        </p>
      </>
    );
  };
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <MsalAppProvider>
        <ThemeProvider>
          <ViewerProvider>
            <Routes>
              <Route
                path="*"
                element={
                  <IndexerHost>
                    <Probe />
                  </IndexerHost>
                }
              />
            </Routes>
          </ViewerProvider>
        </ThemeProvider>
      </MsalAppProvider>
    </MemoryRouter>,
  );
};

describe('<IndexerHost>', () => {
  it('mounts the indexer with the URL deep-link as initialState', async () => {
    renderWith('/c/deep-linked-set');
    const stub = await screen.findByTestId('indexer-stub');
    expect(stub).toHaveTextContent('Active collection: deep-linked-set');
    // The stub emits collection/activated for its initialState in a useEffect
    // that runs after the first commit, so wait for the host's reducer to
    // mirror the value through useActiveCollection.
    await waitFor(() => {
      expect(screen.getByTestId('active-collection').textContent).toBe('deep-linked-set');
    });
  });

  it('updates the URL on collection/activated emitted from the indexer', async () => {
    const user = userEvent.setup();
    renderWith('/');
    await screen.findByTestId('indexer-stub');

    await user.click(screen.getByRole('button', { name: 'Stub collection 1' }));
    expect(screen.getByTestId('active-collection').textContent).toBe('stub-collection-1');
    expect(screen.getByTestId('path').textContent).toBe('/c/stub-collection-1');
  });

  it('flips auth state to expired on auth/expired event from the indexer', async () => {
    const user = userEvent.setup();
    renderWith('/');
    await screen.findByTestId('indexer-stub');

    await user.click(screen.getByRole('button', { name: 'Trigger auth/expired' }));
    expect(screen.getByTestId('auth-status').textContent).toBe('expired');
  });

  it('forces a remount on auth/expired by changing the indexer key', async () => {
    const user = userEvent.setup();
    renderWith('/c/foo');
    const firstStub = await screen.findByTestId('indexer-stub');
    expect(screen.getByTestId('active-collection').textContent).toBe('foo');

    await user.click(screen.getByRole('button', { name: 'Trigger auth/expired' }));

    // After remount the stub instance is replaced — its DOM node is not the
    // same element identity. The host's activeCollection state survives
    // (reducer holds it across the remount).
    const remountedStub = await screen.findByTestId('indexer-stub');
    expect(remountedStub).not.toBe(firstStub);
  });

  it('handles error/unhandled without throwing (no telemetry sink in test env)', async () => {
    const user = userEvent.setup();
    renderWith('/');
    await screen.findByTestId('indexer-stub');

    await user.click(screen.getByRole('button', { name: 'Trigger error/unhandled' }));
    // No assertion beyond "did not throw" — appInsights is null in tests
    // (mocked config has empty connection string) and the handler swallows
    // gracefully.
    expect(screen.getByTestId('indexer-stub')).toBeVisible();
  });

  it('handles collection/list-changed as a no-op', async () => {
    const user = userEvent.setup();
    renderWith('/c/abc');
    await screen.findByTestId('indexer-stub');
    await waitFor(() => {
      expect(screen.getByTestId('active-collection').textContent).toBe('abc');
    });

    await user.click(screen.getByRole('button', { name: 'Trigger collection/list-changed' }));
    // The active collection MUST NOT change when list-changed fires (per
    // module-boundaries.md the v1 handler is a no-op).
    expect(screen.getByTestId('active-collection').textContent).toBe('abc');
  });

  it('mounted state has no axe violations', async () => {
    const { container } = renderWith('/c/abc');
    await screen.findByTestId('indexer-stub');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('persists active collection across imperative selectCollection (back-button equivalent)', async () => {
    const user = userEvent.setup();
    renderWith('/c/initial-set');
    await screen.findByTestId('indexer-stub');
    await waitFor(() => {
      expect(screen.getByTestId('active-collection').textContent).toBe('initial-set');
    });

    await user.click(screen.getByRole('button', { name: 'Stub collection 2' }));
    expect(screen.getByTestId('active-collection').textContent).toBe('stub-collection-2');
    expect(screen.getByTestId('path').textContent).toBe('/c/stub-collection-2');

    // Simulating browser-back via window.history is not supported by
    // MemoryRouter; E2E covers the real back-button. Here we only assert
    // forward navigation.
  });

  it('opens the viewer at page 1 when document/selected fires', async () => {
    const user = userEvent.setup();
    renderWith('/');
    await screen.findByTestId('indexer-stub');

    await user.click(screen.getByRole('button', { name: 'Stub collection 1' }));
    expect(screen.getByTestId('active-collection').textContent).toBe('stub-collection-1');

    // The stub's "Open stub document" button is enabled once a collection is
    // active; clicking it dispatches document/selected through the host's
    // handler. Slice 4: the handler opens the viewer at page 1 with no highlight.
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Open stub document' }));
    });
    expect(screen.getByTestId('active-collection').textContent).toBe('stub-collection-1');
    expect(screen.getByTestId('viewer-open-id').textContent).toBe('stub-doc-1');
  });
});
