/**
 * Returns the imperative IndexerHandle ref so other modules can call
 * `selectCollection(id)` (URL-driven) or `revealDocument(id)` (citation-click
 * follow-through).
 *
 * Returns a ref whose `.current` is null until the federated indexer mounts.
 * Callers check truthiness before invoking.
 */

import { useContext, useRef, type RefObject } from 'react';

import type { IndexerHandle } from '@shared/types';

import { IndexerHostContext } from './IndexerHostContext';

const EMPTY_REF: RefObject<IndexerHandle | null> = { current: null };

export const useIndexerRef = (): RefObject<IndexerHandle | null> => {
  const context = useContext(IndexerHostContext);
  // Stable fallback ref so callers can always destructure safely even when
  // the IndexerHost provider isn't mounted yet (e.g. on the / route).
  const fallback = useRef<IndexerHandle | null>(null);
  if (context) return context.ref;
  return fallback.current === null ? EMPTY_REF : fallback;
};
