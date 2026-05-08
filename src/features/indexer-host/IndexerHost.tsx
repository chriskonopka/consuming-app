/**
 * The MF host boundary. Lazy-loads `<IndexerApp>` via Module Federation,
 * passes the locked prop set, routes IndexerEvents to:
 *   - the indexer-host reducer (collection state + remountKey)
 *   - the URL state hook (push `/c/{id}` on collection/activated)
 *   - `auth.expireAuth()` on `auth/expired`
 *   - `appInsights.trackException` on `error/unhandled`
 *
 * `remountKey` from state is the React `key` on the rendered `<IndexerApp>` —
 * incrementing it after auth recovery throws away the indexer's internal
 * state cleanly without unmounting the rest of the page.
 */

import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';

import type { IndexerAppProps, IndexerEvent, IndexerInitialState } from '@shared/types';

import { useAuth } from '../../auth/useAuth';
import { useAccessToken } from '../../auth/useAccessToken';
import { appInsights } from '../../appInsights';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { config } from '../../config/env';
import { useUrlState } from '../../hooks/useUrlState';
import { useTheme } from '../../theme/useTheme';
import { useViewer } from '../viewer/ViewerContext';

import {
  IndexerHostContextProvider,
  useIndexerHostState,
} from './IndexerHostContext';
import { routeIndexerEvent, type IndexerEventHandlers } from './eventRouter';
import {
  buildInitialIndexerHostState,
  indexerHostReducer,
} from './indexerHostReducer';
import { loadIndexerApp } from './loadIndexerApp';

import styles from './IndexerHost.module.scss';

const LazyIndexerApp = lazy(loadIndexerApp);

/**
 * Inner mount that consumes the context and renders the federated component.
 * Split from the provider so the provider can hold the reducer at a stable
 * identity for the children, while the inner component drives effects keyed
 * to the reducer state.
 */
const IndexerMount = () => {
  const { state, dispatch, indexerRef } = useIndexerHostState();
  const { theme } = useTheme();
  const getAccessToken = useAccessToken();
  const { expireAuth } = useAuth();
  const { documentSetId: urlDocumentSetId, pushCollection } = useUrlState();
  const { open: openViewer } = useViewer();

  // Tracks the URL value the host last reconciled with the indexer. Starts
  // matching the URL because the reducer's `initialState.documentSetId` is
  // already passed to <IndexerApp> as `initialState` — so the indexer is born
  // synced and we don't need a redundant imperative selectCollection.
  const lastReconciledUrlIdRef = useRef<string | null>(state.initialState.documentSetId ?? null);

  // When the URL changes externally (browser back/forward, deep-link to a
  // different collection while mounted), tell the indexer to follow.
  useEffect(() => {
    const target = urlDocumentSetId ?? null;
    if (lastReconciledUrlIdRef.current === target) return;
    lastReconciledUrlIdRef.current = target;
    indexerRef.current?.selectCollection(target);
  }, [urlDocumentSetId, indexerRef]);

  const handlers = useMemo<IndexerEventHandlers>(
    () => ({
      onCollectionActivated: (event) => {
        const next = event.documentSetId
          ? { documentSetId: event.documentSetId, accessRole: event.accessRole ?? 'Owner' }
          : null;
        dispatch({ type: 'COLLECTION_ACTIVATED', activeCollection: next });
        const target = event.documentSetId ?? null;
        if (lastReconciledUrlIdRef.current !== target) {
          lastReconciledUrlIdRef.current = target;
          pushCollection(target);
        }
      },
      onCollectionListChanged: () => {
        // No-op in v1 (per slice-plan.md). Handler exists so the contract
        // surface stays exhaustive — adding behaviour is a future slice.
      },
      onDocumentSelected: (event) => {
        // Open the viewer at page 1 with no citation highlight (api-contracts.md §1.3).
        openViewer(event.documentId, 1, null);
      },
      onAuthExpired: () => {
        expireAuth();
        dispatch({ type: 'INCREMENT_REMOUNT_KEY' });
      },
      onUnhandledError: (event) => {
        if (!appInsights) return;
        try {
          appInsights.trackException({
            exception: new Error(event.messageForLogs),
            properties: event.operationId ? { operationId: event.operationId } : undefined,
          });
        } catch {
          // swallow telemetry failures — observational, never load-bearing
        }
      },
    }),
    [dispatch, expireAuth, pushCollection, openViewer],
  );

  const onEvent = useCallback(
    (event: IndexerEvent) => routeIndexerEvent(event, handlers),
    [handlers],
  );

  const indexerProps: IndexerAppProps = {
    apiBaseUrl: config.apiBaseUrl,
    getAccessToken,
    appInsights: appInsights ?? undefined,
    initialTheme: theme,
    initialState: state.initialState,
    onEvent,
  };

  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className={styles.loading} role="status" aria-live="polite">
            Loading collection browser…
          </div>
        }
      >
        <LazyIndexerApp key={state.remountKey} {...indexerProps} ref={indexerRef} />
      </Suspense>
    </ErrorBoundary>
  );
};

interface IndexerHostProps {
  /**
   * Optional override for the indexer's initial deep-link state. When omitted
   * (the common case), `IndexerHost` reads the URL via `useUrlState` once on
   * mount and freezes it as the indexer's `initialState`.
   */
  initialStateOverride?: IndexerInitialState;
  /** Render-prop slot for siblings (chat panel, viewer panel) that need access to the indexer-host context. */
  children?: ReactNode;
}

export const IndexerHost = ({ initialStateOverride, children }: IndexerHostProps) => {
  const url = useUrlState();
  // Snapshot the URL once on mount — the indexer's `initialState` is a
  // one-shot deep-link, not a reactive prop. Subsequent URL changes are
  // reconciled imperatively via `IndexerHandle.selectCollection()`.
  const initialStateOnMount = useRef<IndexerInitialState>(
    initialStateOverride ?? {
      documentSetId: url.documentSetId ?? undefined,
      folderId: url.folderId ?? undefined,
      documentId: url.documentId ?? undefined,
    },
  ).current;

  const [state, dispatch] = useReducer(
    indexerHostReducer,
    initialStateOnMount,
    buildInitialIndexerHostState,
  );

  return (
    <IndexerHostContextProvider state={state} dispatch={dispatch}>
      <IndexerMount />
      {children}
    </IndexerHostContextProvider>
  );
};
