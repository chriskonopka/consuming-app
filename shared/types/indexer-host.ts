/**
 * Re-exports the indexer's host-contract types for ergonomic deep-import-free access.
 *
 * Source of truth: ../../reusable-indexer/shared/types/host-contract.ts
 *
 * Re-exporting here lets feature modules import from '@shared/types' rather
 * than from 'mws_indexer/types' — keeping the federation surface name out of
 * application code. The federation import only happens in features/indexer-host/
 * where we lazy-load the IndexerApp component.
 */

export type {
  IndexerAppProps,
  IndexerEvent,
  IndexerHandle,
  IndexerInitialState,
  SelectionDocument,
  SelectionFolder,
  ThemeTokenKey,
} from 'mws_indexer/types';

import type { AccessRole } from './api-dtos';

/** Local view of the indexer-host slice of state. */
export interface IndexerHostState {
  activeCollection: ActiveCollection | null;
  /** Parsed from URL on first mount; passed to IndexerApp as initialState. */
  initialState: { documentSetId?: string; folderId?: string; documentId?: string };
  /**
   * Incremented on auth/expired recovery to force a remount of <IndexerApp />.
   * Use as the React `key` on the indexer to discard internal state cleanly.
   */
  remountKey: number;
}

export interface ActiveCollection {
  documentSetId: string;
  accessRole: AccessRole;
}
