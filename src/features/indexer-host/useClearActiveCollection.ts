/**
 * Tear-down hook for the active collection — used by stale-state recovery
 * paths when a docset-scoped API call returns 403/404 (the cached
 * documentSetId no longer corresponds to a live, accessible DocumentSet).
 *
 * Combines the four steps that `onCollectionActivated({ documentSetId: null })`
 * normally performs, so chat / viewer code paths can recover without having
 * to know the full coordination dance:
 *   - push URL back to `/` (drop the deep-linked collection)
 *   - dispatch `COLLECTION_ACTIVATED { activeCollection: null }`
 *   - reset chat-scope selection (per-collection state)
 *   - imperatively tell the indexer to deselect (so its file list clears)
 *
 * Caller is expected to display its own "this collection is no longer
 * available" notice — this hook does not own user-facing UI.
 */

import { useCallback } from 'react';

import { useChatScope } from '../chat-scope';

import { useIndexerHostState } from './IndexerHostContext';
import { useUrlState } from '../../hooks/useUrlState';

export const useClearActiveCollection = (): (() => void) => {
  const { dispatch, indexerRef } = useIndexerHostState();
  const { pushCollection } = useUrlState();
  const chatScope = useChatScope();

  return useCallback(() => {
    pushCollection(null);
    dispatch({ type: 'COLLECTION_ACTIVATED', activeCollection: null });
    chatScope.resetForCollectionChange();
    indexerRef.current?.selectCollection(null);
  }, [dispatch, indexerRef, pushCollection, chatScope]);
};
