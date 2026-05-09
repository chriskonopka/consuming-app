/**
 * Module Federation host component. Lazy-loads `mws_indexer/IndexerApp` and
 * mounts it inside a Suspense boundary. Routes every `IndexerEvent` to the
 * appropriate handler (URL push, active-collection state, auth/expired
 * remount, telemetry).
 *
 * REQUIREMENTS.md §2 covers the full integration spec.
 */

import {
  lazy,
  startTransition,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { appInsights } from '../../appInsights';
import { useAccessToken } from '../../auth/useAccessToken';
import { config } from '../../config/env';
import { useUrlState } from '../../hooks/useUrlState';
import { useTheme } from '../../theme/useTheme';

import type {
  ActiveCollection,
  IndexerEvent,
  IndexerHandle,
} from '@shared/types';

import { IndexerHostContext, type IndexerHostContextValue } from './IndexerHostContext';
import styles from './IndexerHost.module.css';

const IndexerApp = lazy(() => import('mws_indexer/IndexerApp'));

const LoadingState = () => (
  <div role="status" aria-live="polite" className={styles.loading}>
    Loading collection workspace…
  </div>
);

export const IndexerHost = () => {
  const indexerRef = useRef<IndexerHandle | null>(null);
  const [activeCollection, setActiveCollection] =
    useState<ActiveCollection | null>(null);
  const [remountKey, setRemountKey] = useState(0);

  const { theme } = useTheme();
  const getAccessToken = useAccessToken();
  const url = useUrlState();

  // Snapshot the URL state on first mount — used as `initialState` so the
  // indexer hydrates at the deep-linked location. Changes after mount are
  // driven by indexer events, not by re-passing initialState.
  const initialState = useMemo(
    () => ({
      documentSetId: url.documentSetId ?? undefined,
      folderId: url.folderId ?? undefined,
      documentId: url.documentId ?? undefined,
    }),
    // Only set on mount — re-renders shouldn't change initialState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // URL-driven collection switch: when the URL `documentSetId` changes (e.g.
  // user clicks a back-button), call selectCollection on the indexer to
  // mirror. The indexer emits `collection/activated` if the change took.
  useEffect(() => {
    if (!url.documentSetId) {
      indexerRef.current?.selectCollection(null);
      return;
    }
    if (activeCollection?.documentSetId !== url.documentSetId) {
      indexerRef.current?.selectCollection(url.documentSetId);
    }
  }, [url.documentSetId, activeCollection?.documentSetId]);

  const handleEvent = useCallback(
    (event: IndexerEvent) => {
      switch (event.type) {
        case 'auth/expired': {
          // Trigger silent token refresh by remounting <IndexerApp /> with a
          // new key. The indexer re-fetches via the host's getAccessToken
          // callback on remount — that path itself does silent acquire +
          // popup fallback.
          setRemountKey((k) => k + 1);
          return;
        }
        case 'collection/activated': {
          // Wrap both updates in a transition so they share the same priority
          // lane and apply in a single render. Without this, setActiveCollection
          // (urgent) lands before navigate (transition in react-router v7);
          // the sync effect below then runs in the intermediate render and
          // sees activeCollection populated while url.documentSetId is still
          // stale-null — which it interprets as "deselect" and dispatches
          // selectCollection(null), wiping the indexer's state and bouncing
          // the user back to the collection list.
          startTransition(() => {
            if (event.documentSetId && event.accessRole) {
              setActiveCollection({
                documentSetId: event.documentSetId,
                accessRole: event.accessRole,
              });
              url.pushCollection(event.documentSetId);
            } else {
              setActiveCollection(null);
              url.pushCollection(null);
            }
          });
          return;
        }
        case 'collection/list-changed': {
          // No-op for v1 — the host doesn't currently maintain a collection
          // list outside of the indexer's own state.
          return;
        }
        case 'document/selected': {
          // Slice 4 opens the viewer. For now, just push the URL so deep-links work.
          url.pushDocument(event.documentId);
          return;
        }
        case 'error/unhandled': {
          appInsights?.trackException({
            exception: new Error(event.messageForLogs),
            properties: {
              source: 'mws_indexer',
              operationId: event.operationId ?? undefined,
            },
          });
          return;
        }
      }
    },
    [url],
  );

  const contextValue = useMemo<IndexerHostContextValue>(
    () => ({
      ref: indexerRef,
      activeCollection,
    }),
    [activeCollection],
  );

  return (
    <IndexerHostContext.Provider value={contextValue}>
      <Suspense fallback={<LoadingState />}>
        <IndexerApp
          key={remountKey}
          ref={indexerRef}
          apiBaseUrl={config.apiBaseUrl}
          getAccessToken={getAccessToken}
          appInsights={appInsights ?? undefined}
          initialTheme={theme}
          initialState={initialState}
          onEvent={handleEvent}
        />
      </Suspense>
    </IndexerHostContext.Provider>
  );
};
