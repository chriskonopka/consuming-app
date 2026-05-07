/**
 * What belongs here: returns the imperative IndexerHandle ref so other
 * modules can call `selectCollection(id)` (URL-driven) or `revealDocument(id)`
 * (citation-click follow-through).
 *
 * Scaffolded — implementation lands in slice 2.
 */

import type { RefObject } from 'react';
import type { IndexerHandle } from '@shared/types';

export const useIndexerRef = (): RefObject<IndexerHandle | null> => {
  return { current: null };
};
