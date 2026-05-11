/**
 * Chat-scope reducer — tracks which documents and folders the user has picked
 * to narrow the next chat send. The server treats empty arrays as "whole
 * DocumentSet" (legacy behavior), so empty is the unscoped default.
 *
 * State carries the rich payload shipped by the indexer's `selection/changed`
 * event (PR #3 / 3cf5603): document → `{ documentId, fileName }`, folder →
 * `{ folderId, folderName, path }`. Chip labels read straight from here — no
 * `useDocumentMetadata` lookup needed.
 *
 * Sources of state changes:
 *   - `SET_SELECTION`: the indexer's `selection/changed` event — authoritative
 *     replace of both arrays. Indexer is the source of truth.
 *   - `REMOVE_DOCUMENT` / `REMOVE_FOLDER` / `CLEAR`: chat-side affordances on
 *     `<ScopeIndicator>`. These are *local overrides* that diverge from the
 *     indexer's UI until the next `selection/changed` mutation re-syncs.
 *     Documented and intentional — see slice doc.
 *   - `RESET_FOR_COLLECTION_CHANGE`: defensive belt-and-braces. The indexer
 *     also emits `selection/changed` with empty arrays on collection switch
 *     (per the API team's confirmation), so this is redundant but cheap.
 *
 * Per-array cap of 64 (`SEND_MESSAGE_SELECTION_MAX`) is the server boundary.
 * `SET_SELECTION` dedupes by id and truncates above the cap; the indexer also
 * enforces the cap before emitting, so truncation here is defense in depth.
 *
 * web-state-management.md: exhaustive switch, no `default`, discriminated union.
 */

import {
  SEND_MESSAGE_SELECTION_MAX,
  type SelectionDocument,
  type SelectionFolder,
} from '@shared/types';

export interface ChatScopeState {
  documents: SelectionDocument[];
  folders: SelectionFolder[];
}

export type ChatScopeAction =
  | { type: 'SET_SELECTION'; documents: SelectionDocument[]; folders: SelectionFolder[] }
  | { type: 'REMOVE_DOCUMENT'; documentId: string }
  | { type: 'REMOVE_FOLDER'; folderId: string }
  | { type: 'CLEAR' }
  | { type: 'RESET_FOR_COLLECTION_CHANGE' };

export const buildInitialChatScopeState = (): ChatScopeState => ({
  documents: [],
  folders: [],
});

const dedupeAndCapDocuments = (list: readonly SelectionDocument[]): SelectionDocument[] => {
  const seen = new Set<string>();
  const result: SelectionDocument[] = [];
  for (const item of list) {
    if (seen.has(item.documentId)) continue;
    seen.add(item.documentId);
    result.push(item);
    if (result.length >= SEND_MESSAGE_SELECTION_MAX) break;
  }
  return result;
};

const dedupeAndCapFolders = (list: readonly SelectionFolder[]): SelectionFolder[] => {
  const seen = new Set<string>();
  const result: SelectionFolder[] = [];
  for (const item of list) {
    if (seen.has(item.folderId)) continue;
    seen.add(item.folderId);
    result.push(item);
    if (result.length >= SEND_MESSAGE_SELECTION_MAX) break;
  }
  return result;
};

export const chatScopeReducer = (
  state: ChatScopeState,
  action: ChatScopeAction,
): ChatScopeState => {
  switch (action.type) {
    case 'SET_SELECTION':
      return {
        documents: dedupeAndCapDocuments(action.documents),
        folders: dedupeAndCapFolders(action.folders),
      };
    case 'REMOVE_DOCUMENT': {
      const index = state.documents.findIndex((doc) => doc.documentId === action.documentId);
      if (index === -1) return state;
      return {
        ...state,
        documents: [...state.documents.slice(0, index), ...state.documents.slice(index + 1)],
      };
    }
    case 'REMOVE_FOLDER': {
      const index = state.folders.findIndex((folder) => folder.folderId === action.folderId);
      if (index === -1) return state;
      return {
        ...state,
        folders: [...state.folders.slice(0, index), ...state.folders.slice(index + 1)],
      };
    }
    case 'CLEAR':
    case 'RESET_FOR_COLLECTION_CHANGE':
      if (state.documents.length === 0 && state.folders.length === 0) {
        return state;
      }
      return buildInitialChatScopeState();
  }
};
