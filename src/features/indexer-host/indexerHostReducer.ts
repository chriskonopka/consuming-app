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
  // Seed activeCollection from the URL-derived initialState. When the page
  // loads at `/c/<documentSetId>`, the indexer is born inside that
  // collection via the same `initialState` prop and does not re-emit
  // `collection/activated` (it's already there from its POV). Without this
  // seeding the consumer's host state would stay at `activeCollection: null`
  // forever and the chat panel would keep showing "Open a collection to
  // start chatting" with the input disabled, even though the indexer is
  // clearly rendering the active collection's documents. The accessRole is
  // assumed Owner because the URL alone does not carry role info — the
  // indexer/API will correct it via `collection/activated` if the caller is
  // a Shared user (the role only affects telemetry tagging today, not
  // access control, which is enforced server-side regardless).
  //
  // Note: in practice MSAL's `loginRedirect` flow also bounces the user back
  // to `/` (not the original deep-link), so the URL is empty on first mount
  // even when the user *meant* to land at `/c/<id>`. The URL-watching effect
  // in `IndexerHost` is the second half of the seed and catches the case
  // where the indexer (or any other code) pushes the URL to `/c/<id>` after
  // mount via raw `history.pushState`.
  activeCollection: initialState.documentSetId
    ? { documentSetId: initialState.documentSetId, accessRole: 'Owner' }
    : null,
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
