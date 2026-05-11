/**
 * Provider + hook for `ChatScopeState`. Lives above `<IndexerHost>` and
 * `<ChatPanel>` so the indexer's `document/selected` bridge (today) and the
 * indexer's planned `selection/changed` event (future) can both write to the
 * same state the chat send path reads from.
 *
 * Exports:
 *   - `<ChatScopeProvider>` — owns the reducer.
 *   - `useChatScope()` — returns state + the action creators the rest of the
 *     app calls.
 *
 * Throwing when used outside the provider keeps misuse loud — every consumer
 * (IndexerHost bridge, ChatPanel, ScopeIndicator, useSseChat send path) is on
 * the AppShell render path and must see the provider.
 */

import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react';

import {
  buildInitialChatScopeState,
  chatScopeReducer,
  type ChatScopeState,
} from './chatScopeReducer';

export interface ChatScopeActions {
  toggleDocument: (documentId: string) => void;
  toggleFolder: (folderId: string) => void;
  removeDocument: (documentId: string) => void;
  removeFolder: (folderId: string) => void;
  setSelection: (documentIds: string[], folderIds: string[]) => void;
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

  const toggleDocument = useCallback(
    (documentId: string) => dispatch({ type: 'TOGGLE_DOCUMENT', documentId }),
    [],
  );
  const toggleFolder = useCallback(
    (folderId: string) => dispatch({ type: 'TOGGLE_FOLDER', folderId }),
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
  const setSelection = useCallback(
    (documentIds: string[], folderIds: string[]) =>
      dispatch({ type: 'SET_SELECTION', documentIds, folderIds }),
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
      toggleDocument,
      toggleFolder,
      removeDocument,
      removeFolder,
      setSelection,
      clear,
      resetForCollectionChange,
    }),
    [
      state,
      toggleDocument,
      toggleFolder,
      removeDocument,
      removeFolder,
      setSelection,
      clear,
      resetForCollectionChange,
    ],
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
