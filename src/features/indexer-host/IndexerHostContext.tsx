/**
 * Internal context for the indexer-host slice. Holds the imperative ref to
 * `<IndexerApp>` plus the active collection state. Other features access
 * via the public hooks `useIndexerRef()` and `useActiveCollection()`.
 */

import { createContext, type RefObject } from 'react';

import type { ActiveCollection, IndexerHandle } from '@shared/types';

export interface IndexerHostContextValue {
  ref: RefObject<IndexerHandle | null>;
  activeCollection: ActiveCollection | null;
}

export const IndexerHostContext = createContext<IndexerHostContextValue | null>(null);
