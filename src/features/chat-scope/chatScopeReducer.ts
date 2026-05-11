/**
 * Chat-scope reducer — tracks which documents and folders the user has picked
 * to narrow the next chat send. The server treats empty arrays as "whole
 * DocumentSet" (legacy behavior), so empty is the unscoped default.
 *
 * Sources of state changes:
 *   - `TOGGLE_DOCUMENT` / `TOGGLE_FOLDER`: transitional bridge from the
 *     indexer's `document/selected` event (see IndexerHost.tsx). Goes away
 *     once the indexer ships its dedicated selection event.
 *   - `SET_SELECTION`: future entry point for the indexer's planned
 *     `selection/changed` event — the indexer becomes the source of truth and
 *     the consumer mirrors it. See docs/architecture/indexer-handoff-selection-event.md.
 *   - `REMOVE_DOCUMENT` / `REMOVE_FOLDER` / `CLEAR`: user-driven via the
 *     ScopeIndicator chips.
 *   - `RESET_FOR_COLLECTION_CHANGE`: scope doesn't carry across document sets;
 *     activating a different collection clears it.
 *
 * Per-array cap of 64 (server boundary) is enforced inside the reducer — TOGGLE
 * and SET ignore adds that would exceed the cap. SET truncates explicitly.
 * web-state-management.md: exhaustive switch, no `default`.
 */

import { SEND_MESSAGE_SELECTION_MAX } from '@shared/types';

export interface ChatScopeState {
  documentIds: string[];
  folderIds: string[];
}

export type ChatScopeAction =
  | { type: 'TOGGLE_DOCUMENT'; documentId: string }
  | { type: 'TOGGLE_FOLDER'; folderId: string }
  | { type: 'REMOVE_DOCUMENT'; documentId: string }
  | { type: 'REMOVE_FOLDER'; folderId: string }
  | { type: 'SET_SELECTION'; documentIds: string[]; folderIds: string[] }
  | { type: 'CLEAR' }
  | { type: 'RESET_FOR_COLLECTION_CHANGE' };

export const buildInitialChatScopeState = (): ChatScopeState => ({
  documentIds: [],
  folderIds: [],
});

const toggleInArray = (list: string[], value: string): string[] => {
  const index = list.indexOf(value);
  if (index !== -1) {
    return [...list.slice(0, index), ...list.slice(index + 1)];
  }
  if (list.length >= SEND_MESSAGE_SELECTION_MAX) {
    return list;
  }
  return [...list, value];
};

const dedupeAndCap = (list: readonly string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of list) {
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
    if (result.length >= SEND_MESSAGE_SELECTION_MAX) break;
  }
  return result;
};

export const chatScopeReducer = (
  state: ChatScopeState,
  action: ChatScopeAction,
): ChatScopeState => {
  switch (action.type) {
    case 'TOGGLE_DOCUMENT': {
      const next = toggleInArray(state.documentIds, action.documentId);
      if (next === state.documentIds) return state;
      return { ...state, documentIds: next };
    }
    case 'TOGGLE_FOLDER': {
      const next = toggleInArray(state.folderIds, action.folderId);
      if (next === state.folderIds) return state;
      return { ...state, folderIds: next };
    }
    case 'REMOVE_DOCUMENT': {
      const index = state.documentIds.indexOf(action.documentId);
      if (index === -1) return state;
      return {
        ...state,
        documentIds: [...state.documentIds.slice(0, index), ...state.documentIds.slice(index + 1)],
      };
    }
    case 'REMOVE_FOLDER': {
      const index = state.folderIds.indexOf(action.folderId);
      if (index === -1) return state;
      return {
        ...state,
        folderIds: [...state.folderIds.slice(0, index), ...state.folderIds.slice(index + 1)],
      };
    }
    case 'SET_SELECTION':
      return {
        documentIds: dedupeAndCap(action.documentIds),
        folderIds: dedupeAndCap(action.folderIds),
      };
    case 'CLEAR':
    case 'RESET_FOR_COLLECTION_CHANGE':
      if (state.documentIds.length === 0 && state.folderIds.length === 0) {
        return state;
      }
      return buildInitialChatScopeState();
  }
};
