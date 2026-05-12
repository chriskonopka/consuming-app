import { renderHook, act } from '@testing-library/react';
import { useEffect, useReducer, type ReactNode } from 'react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

import type { IndexerHandle, IndexerHostState } from '@shared/types';

import { ChatScopeProvider, useChatScope } from '../chat-scope';

import { IndexerHostContextProvider } from './IndexerHostContext';
import {
  buildInitialIndexerHostState,
  indexerHostReducer,
} from './indexerHostReducer';
import { useClearActiveCollection } from './useClearActiveCollection';

const DOCSET_ID = 'col-1';

// Captures the current URL pathname so tests can assert the push-to-root
// behaviour without depending on react-router internals.
const LocationProbe = ({ onPath }: { onPath: (path: string) => void }) => {
  const location = useLocation();
  onPath(location.pathname);
  return null;
};

interface ProvidersProps {
  children: ReactNode;
  indexerRef: { current: IndexerHandle | null };
  onPath?: (path: string) => void;
}

const Providers = ({ children, indexerRef, onPath }: ProvidersProps) => {
  const [state, dispatch] = useReducer(
    indexerHostReducer,
    { documentSetId: DOCSET_ID },
    (input): IndexerHostState => ({
      ...buildInitialIndexerHostState(input),
      activeCollection: { documentSetId: DOCSET_ID, accessRole: 'Owner' },
    }),
  );
  return (
    <MemoryRouter initialEntries={[`/c/${DOCSET_ID}`]}>
      <Routes>
        <Route
          path="*"
          element={
            <ChatScopeProvider>
              <IndexerHostContextProvider state={state} dispatch={dispatch}>
                {/* Inject the indexerRef via the context provider so the hook
                    under test can call selectCollection(null). */}
                <IndexerRefBridge indexerRef={indexerRef} />
                {onPath ? <LocationProbe onPath={onPath} /> : null}
                {children}
              </IndexerHostContextProvider>
            </ChatScopeProvider>
          }
        />
      </Routes>
    </MemoryRouter>
  );
};

// IndexerHostContextProvider owns the indexerRef internally — to inject a
// spy ref for testing, mirror it into the provider's ref via a small bridge
// component that runs once on mount.
import { useIndexerRef } from './IndexerHostContext';
const IndexerRefBridge = ({
  indexerRef,
}: {
  indexerRef: { current: IndexerHandle | null };
}) => {
  const ref = useIndexerRef();
  useEffect(() => {
    ref.current = indexerRef.current;
  }, [ref, indexerRef]);
  return null;
};

describe('useClearActiveCollection', () => {
  it('pushes URL to /, clears chat scope, and tells the indexer to deselect', () => {
    const selectCollection = jest.fn();
    const revealDocument = jest.fn();
    const indexerRef: { current: IndexerHandle | null } = {
      current: { selectCollection, revealDocument },
    };
    let lastPath = '';

    const { result } = renderHook(
      () => {
        const clear = useClearActiveCollection();
        const scope = useChatScope();
        return { clear, scope };
      },
      {
        wrapper: ({ children }) => (
          <Providers indexerRef={indexerRef} onPath={(path) => (lastPath = path)}>
            {children}
          </Providers>
        ),
      },
    );

    // Seed some scope so we can verify the reset.
    act(() =>
      result.current.scope.setSelection(
        [{ documentId: 'doc-x', fileName: 'x.pdf' }],
        [],
      ),
    );
    expect(result.current.scope.state.documents).toHaveLength(1);

    act(() => result.current.clear());

    expect(lastPath).toBe('/');
    expect(result.current.scope.state.documents).toHaveLength(0);
    expect(selectCollection).toHaveBeenCalledWith(null);
  });

  it('is a no-op-safe when the indexerRef is not yet mounted', () => {
    const indexerRef: { current: IndexerHandle | null } = { current: null };
    const { result } = renderHook(() => useClearActiveCollection(), {
      wrapper: ({ children }) => (
        <Providers indexerRef={indexerRef}>{children}</Providers>
      ),
    });

    expect(() => act(() => result.current())).not.toThrow();
  });
});
