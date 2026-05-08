/**
 * Reducer for `IndexerHostState`. Owns the activeCollection mirror, the
 * `initialState` parsed from the URL on first mount, and the `remountKey`
 * counter used to force-remount `<IndexerApp>` after `auth/expired`.
 *
 * Per data-model.md §2.2; per web-state-management.md the reducer uses an
 * exhaustive switch over a discriminated-union action type with no `default`
 * branch — the compiler catches missing cases.
 */

import type {
  ActiveCollection,
  IndexerHostState,
  IndexerInitialState,
} from '@shared/types';

export type IndexerHostAction =
  | { type: 'COLLECTION_ACTIVATED'; activeCollection: ActiveCollection | null }
  | { type: 'INCREMENT_REMOUNT_KEY' };

export const buildInitialIndexerHostState = (
  initialState: IndexerInitialState,
): IndexerHostState => ({
  activeCollection: null,
  initialState,
  remountKey: 0,
});

export const indexerHostReducer = (
  state: IndexerHostState,
  action: IndexerHostAction,
): IndexerHostState => {
  switch (action.type) {
    case 'COLLECTION_ACTIVATED':
      return { ...state, activeCollection: action.activeCollection };
    case 'INCREMENT_REMOUNT_KEY':
      return { ...state, remountKey: state.remountKey + 1 };
  }
};
