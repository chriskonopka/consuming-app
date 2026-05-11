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
import { ChatScopeProvider, useChatScope } from '../chat-scope';
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
    const scope = useChatScope();
    return (
      <>
        <p data-testid="active-collection">{collection?.documentSetId ?? 'none'}</p>
        <p data-testid="auth-status">{state.status}</p>
        <p data-testid="path">{location.pathname}</p>
        <p data-testid="viewer-open-id">{viewer.state.open?.documentId ?? 'none'}</p>
        <p data-testid="scope-doc-ids">{scope.state.documentIds.join(',') || 'none'}</p>
      </>
    );
  };
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <MsalAppProvider>
        <ThemeProvider>
          <ChatScopeProvider>
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
          </ChatScopeProvider>
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

  // Regression for main@88e3c38: a fully-resolved `collection/activated` must
  // NOT cause the URL-reconciliation effect to fire `selectCollection(null)`
  // on the indexer ref. The bug it guards against — the host's reducer
  // dispatch (urgent priority) used to land before `pushCollection` (transition
  // priority in react-router-dom v7); the sync effect ran in the intermediate
  // render with stale-null `urlDocumentSetId` and dispatched a spurious
  // `selectCollection(null)`, wiping the indexer's state and bouncing the user
  // back to the collection list. The stub echoes `selectCollection(id)` back as
  // a `collection/activated` event, so any spurious null-deselect would zero
  // the stub's `Active collection:` text. Assert it persists across a flush.
  it('does not bounce back to none after activating a collection', async () => {
    const user = userEvent.setup();
    renderWith('/');
    const stub = await screen.findByTestId('indexer-stub');

    await user.click(screen.getByRole('button', { name: 'Stub collection 1' }));
    expect(stub).toHaveTextContent('Active collection: stub-collection-1');

    // Flush any deferred / transition updates the URL effect may schedule.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(stub).toHaveTextContent('Active collection: stub-collection-1');
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

  // Transitional bridge until the indexer ships its `selection/changed`
  // event — `document/selected` toggles the doc in chat scope so the next
  // chat send is narrowed to it. Will be replaced by a SET_SELECTION listener.
  it('toggles the doc in chat scope when document/selected fires', async () => {
    const user = userEvent.setup();
    renderWith('/');
    await screen.findByTestId('indexer-stub');

    await user.click(screen.getByRole('button', { name: 'Stub collection 1' }));
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Open stub document' }));
    });
    expect(screen.getByTestId('scope-doc-ids').textContent).toBe('stub-doc-1');

    // Second click toggles the doc out of scope.
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Open stub document' }));
    });
    expect(screen.getByTestId('scope-doc-ids').textContent).toBe('none');
  });

  it('resets chat scope when the active collection changes', async () => {
    const user = userEvent.setup();
    renderWith('/');
    await screen.findByTestId('indexer-stub');

    await user.click(screen.getByRole('button', { name: 'Stub collection 1' }));
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Open stub document' }));
    });
    expect(screen.getByTestId('scope-doc-ids').textContent).toBe('stub-doc-1');

    // Switching to a different collection clears stale doc scope.
    await user.click(screen.getByRole('button', { name: 'Stub collection 2' }));
    expect(screen.getByTestId('scope-doc-ids').textContent).toBe('none');
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
