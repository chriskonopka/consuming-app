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
  startTransition,
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
import { useChatScope } from '../chat-scope';
import { useViewer } from '../viewer/ViewerContext';

import { IndexerHostContextProvider, useIndexerHostState } from './IndexerHostContext';
import { routeIndexerEvent, type IndexerEventHandlers } from './eventRouter';
import { buildInitialIndexerHostState, indexerHostReducer } from './indexerHostReducer';
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
  const chatScope = useChatScope();

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

  // The federated indexer can change the URL via raw `window.history.pushState`
  // (or its own internal router), bypassing react-router-dom.
  // `useMatch('/c/:documentSetId')` only updates on react-router's own
  // navigations and the browser's native `popstate` event, so a direct
  // pushState leaves `urlDocumentSetId` stale-null forever and
  // `activeCollection` never gets seeded — leaving the chat panel disabled
  // and the input greyed out even though a collection is clearly active.
  //
  // This effect watches `window.location.pathname` directly via popstate plus
  // a 250ms polling fallback (cheap — one regex match + two ref reads on each
  // tick), and dispatches `COLLECTION_ACTIVATED` when the `/c/<id>` segment
  // changes. Refs hold cross-tick state so the effect mounts once and never
  // re-runs (avoiding interval churn).
  //
  // The accessRole is assumed Owner because the URL alone does not carry
  // role info — the indexer/API will correct it via `collection/activated`
  // if the caller is a Shared user (telemetry-only field today).
  const lastUrlSyncTargetRef = useRef<string | null>(null);
  const activeCollectionDocSetIdRef = useRef<string | null>(
    state.activeCollection?.documentSetId ?? null,
  );
  activeCollectionDocSetIdRef.current = state.activeCollection?.documentSetId ?? null;
  useEffect(() => {
    const COLLECTION_PATH_RX = /^\/c\/([^/?#]+)/;
    const sync = () => {
      const match = window.location.pathname.match(COLLECTION_PATH_RX);
      const target = match?.[1] ? decodeURIComponent(match[1]) : null;
      if (target === lastUrlSyncTargetRef.current) return;
      lastUrlSyncTargetRef.current = target;
      if (target === activeCollectionDocSetIdRef.current) return;
      dispatch({
        type: 'COLLECTION_ACTIVATED',
        activeCollection: target ? { documentSetId: target, accessRole: 'Owner' } : null,
      });
    };
    sync();
    window.addEventListener('popstate', sync);
    const intervalId = window.setInterval(sync, 250);
    return () => {
      window.removeEventListener('popstate', sync);
      window.clearInterval(intervalId);
    };
  }, [dispatch]);

  const handlers = useMemo<IndexerEventHandlers>(
    () => ({
      onCollectionActivated: (event) => {
        // Wrap both updates in a transition so they share the same priority
        // lane and apply in a single render. Without this, the reducer dispatch
        // (urgent) lands before pushCollection (transition priority in
        // react-router-dom v7); the URL-reconciliation effect below then runs
        // in the intermediate render and sees activeCollection populated while
        // urlDocumentSetId is still stale-null, interprets that as "deselect",
        // and calls selectCollection(null) on the indexer — wiping its state
        // and bouncing the user back to the collection list. See main@88e3c38.
        const next = event.documentSetId
          ? { documentSetId: event.documentSetId, accessRole: event.accessRole ?? 'Owner' }
          : null;
        const target = event.documentSetId ?? null;
        startTransition(() => {
          dispatch({ type: 'COLLECTION_ACTIVATED', activeCollection: next });
          if (lastReconciledUrlIdRef.current !== target) {
            lastReconciledUrlIdRef.current = target;
            pushCollection(target);
          }
        });
        // Chat scope is per-DocumentSet — a different collection's docs aren't
        // valid retrieval scope, so any stale selection is cleared on switch.
        chatScope.resetForCollectionChange();
      },
      onCollectionListChanged: () => {
        // No-op in v1 (per slice-plan.md). Handler exists so the contract
        // surface stays exhaustive — adding behaviour is a future slice.
      },
      onDocumentSelected: (event) => {
        // Open the viewer at page 1 with no citation highlight (api-contracts.md §1.3).
        // Chat-scope changes arrive via `selection/changed` only — keeping
        // viewer-open separate from chat-scope per the API team's intent.
        openViewer(event.documentId, 1, null);
      },
      onSelectionChanged: (event) => {
        // Indexer is the source of truth for chat-scope selection (PR #3 /
        // 3cf5603). Both arrays are always present; empty means "clear", which
        // also covers collection switch (indexer emits empty arrays for the
        // new set id). The reducer dedupes + caps at SEND_MESSAGE_SELECTION_MAX
        // defensively even though the indexer already enforces the cap.
        chatScope.setSelection(event.documents, event.folders);
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
    [dispatch, expireAuth, pushCollection, openViewer, chatScope],
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
        <LazyIndexerApp
          key={`${state.remountKey}:${theme}`}
          {...indexerProps}
          ref={indexerRef}
        />
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
