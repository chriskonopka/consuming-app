/**
 * Provider + hook for `ChatScopeState`. Lives above `<IndexerHost>` and
 * `<ChatPanel>` so the indexer's `selection/changed` event handler (which
 * lives in IndexerHost.tsx) and the chat send path see the same state.
 *
 * The indexer is the authoritative source of selection — `setSelection` is
 * called from the IndexerHost event handler on every `selection/changed`
 * emission. The user-facing `removeDocument` / `removeFolder` / `clear`
 * actions are local overrides that diverge from the indexer's UI until the
 * next `selection/changed` re-syncs.
 */

import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react';

import type { SelectionDocument, SelectionFolder } from '@shared/types';

import {
  buildInitialChatScopeState,
  chatScopeReducer,
  type ChatScopeState,
} from './chatScopeReducer';

export interface ChatScopeActions {
  setSelection: (documents: SelectionDocument[], folders: SelectionFolder[]) => void;
  removeDocument: (documentId: string) => void;
  removeFolder: (folderId: string) => void;
  clear: () => void;
  resetForCollectionChange: () => void;
}

export interface ChatScopeContextValue extends ChatScopeActions {
  state: ChatScopeState;
}

const ChatScopeContext = createContext<ChatScopeContextValue | null>(null);

interface ProviderProps {
  children: ReactNode;
}

export const ChatScopeProvider = ({ children }: ProviderProps) => {
  const [state, dispatch] = useReducer(chatScopeReducer, undefined, buildInitialChatScopeState);

  const setSelection = useCallback(
    (documents: SelectionDocument[], folders: SelectionFolder[]) =>
      dispatch({ type: 'SET_SELECTION', documents, folders }),
    [],
  );
  const removeDocument = useCallback(
    (documentId: string) => dispatch({ type: 'REMOVE_DOCUMENT', documentId }),
    [],
  );
  const removeFolder = useCallback(
    (folderId: string) => dispatch({ type: 'REMOVE_FOLDER', folderId }),
    [],
  );
  const clear = useCallback(() => dispatch({ type: 'CLEAR' }), []);
  const resetForCollectionChange = useCallback(
    () => dispatch({ type: 'RESET_FOR_COLLECTION_CHANGE' }),
    [],
  );

  const value = useMemo<ChatScopeContextValue>(
    () => ({
      state,
      setSelection,
      removeDocument,
      removeFolder,
      clear,
      resetForCollectionChange,
    }),
    [state, setSelection, removeDocument, removeFolder, clear, resetForCollectionChange],
  );

  return <ChatScopeContext.Provider value={value}>{children}</ChatScopeContext.Provider>;
};

export const useChatScope = (): ChatScopeContextValue => {
  const value = useContext(ChatScopeContext);
  if (!value) {
    throw new Error('useChatScope must be called inside <ChatScopeProvider>');
  }
  return value;
};
