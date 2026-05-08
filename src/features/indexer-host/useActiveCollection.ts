/**
 * Returns the currently-active collection (driven by `collection/activated`
 * indexer events) so other modules can scope to it. `null` when no
 * collection is active or the IndexerHost isn't mounted.
 */

import { useContext } from 'react';

import type { ActiveCollection } from '@shared/types';

import { IndexerHostContext } from './IndexerHostContext';

export const useActiveCollection = (): ActiveCollection | null => {
  const context = useContext(IndexerHostContext);
  return context?.activeCollection ?? null;
};
