/**
 * Context that exposes the viewer state plus an open/close API to the rest of
 * the app. Mounted at `<AppShell>` level so the chat panel's citation click
 * (`useCitationClick`), the source list, and the indexer's `document/selected`
 * event router all dispatch into the same state.
 *
 * Keeping the dispatch inside the context (rather than re-exporting it) means
 * consumers don't need to know the `ViewerAction` shape — the public surface is
 * `open(documentId, page, highlight?)` / `close()` / `setPage(page)`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';

import type { CitationRect, ViewerState } from '@shared/types';

import {
  INITIAL_VIEWER_STATE,
  viewerReducer,
  type ViewerAction,
} from './viewerReducer';

interface ViewerContextValue {
  state: ViewerState;
  dispatch: Dispatch<ViewerAction>;
  open: (documentId: string, page: number, highlight?: CitationRect | null) => void;
  close: () => void;
  setPage: (page: number) => void;
}

const ViewerContext = createContext<ViewerContextValue | null>(null);

interface ProviderProps {
  children: ReactNode;
  /** Optional override for tests — lets a test inject a starting state. */
  initialState?: ViewerState;
}

export const ViewerProvider = ({ children, initialState = INITIAL_VIEWER_STATE }: ProviderProps) => {
  const [state, dispatch] = useReducer(viewerReducer, initialState);

  const open = useCallback(
    (documentId: string, page: number, highlight: CitationRect | null = null) => {
      dispatch({ type: 'OPEN', documentId, page, highlight });
    },
    [],
  );

  const close = useCallback(() => dispatch({ type: 'CLOSE' }), []);
  const setPage = useCallback((page: number) => dispatch({ type: 'SET_PAGE', page }), []);

  const value = useMemo<ViewerContextValue>(
    () => ({ state, dispatch, open, close, setPage }),
    [state, open, close, setPage],
  );

  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>;
};

const useViewerContext = (): ViewerContextValue => {
  const value = useContext(ViewerContext);
  if (!value) {
    throw new Error('useViewer* must be called inside <ViewerProvider>');
  }
  return value;
};

export const useViewer = (): ViewerContextValue => useViewerContext();
