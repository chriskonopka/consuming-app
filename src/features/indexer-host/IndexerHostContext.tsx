/**
 * Context that exposes the indexer-host slice state plus the imperative
 * `IndexerHandle` ref to other features.
 *
 * - `useActiveCollection()` reads `state.activeCollection` for cross-feature
 *   scoping (chat, viewer in later slices).
 * - `useIndexerRef()` returns the ref so a citation click in chat (slice 4)
 *   can call `revealDocument(id)` on the indexer.
 *
 * The ref's `.current` may be null until the lazy `<IndexerApp>` mounts; all
 * callers must null-check (per host-contract: "best-effort, no-op when null").
 */

import {
  createContext,
  useContext,
  useMemo,
  useRef,
  type Dispatch,
  type ReactNode,
  type RefObject,
} from 'react';

import type { IndexerHandle, IndexerHostState } from '@shared/types';

import type { IndexerHostAction } from './indexerHostReducer';

interface IndexerHostContextValue {
  state: IndexerHostState;
  dispatch: Dispatch<IndexerHostAction>;
  indexerRef: RefObject<IndexerHandle | null>;
}

const IndexerHostContext = createContext<IndexerHostContextValue | null>(null);

interface ProviderProps {
  state: IndexerHostState;
  dispatch: Dispatch<IndexerHostAction>;
  children: ReactNode;
}

export const IndexerHostContextProvider = ({ state, dispatch, children }: ProviderProps) => {
  const indexerRef = useRef<IndexerHandle | null>(null);
  const value = useMemo<IndexerHostContextValue>(
    () => ({ state, dispatch, indexerRef }),
    [state, dispatch],
  );
  return <IndexerHostContext.Provider value={value}>{children}</IndexerHostContext.Provider>;
};

const useIndexerHostContext = (): IndexerHostContextValue => {
  const value = useContext(IndexerHostContext);
  if (!value) {
    throw new Error('useIndexerHost* must be called inside <IndexerHost>');
  }
  return value;
};

export const useActiveCollection = () => useIndexerHostContext().state.activeCollection;

export const useIndexerRef = (): RefObject<IndexerHandle | null> =>
  useIndexerHostContext().indexerRef;

export const useIndexerHostState = () => useIndexerHostContext();
