/**
 * Per-collection chat session hook.
 *
 * Wires:
 *   - The chat reducer (composer text, streaming buffer, conversation id).
 *   - `useConversation` — resolves the existing conversation on activation,
 *     pushed into the reducer via `CONVERSATION_RESOLVED`.
 *   - The `documentSetId → SET_DOCUMENT_SET` reset on collection change so a
 *     stale streaming buffer never leaks across collections.
 *
 * History (`useChatHistory`) is owned by `<ChatPanel>` because the message
 * list reads it directly from TanStack Query rather than mirroring it through
 * the reducer (server-authoritative — see data-model.md §1).
 *
 * Returns the reducer state, dispatch, and the streaming-status flag for UI
 * gating.
 */

import { useEffect, useReducer, type Dispatch } from 'react';

import type { ChatSession } from '@shared/types';

import { buildInitialChatSession, chatReducer, type ChatAction } from './chatReducer';
import { useConversation, type UseConversationOptions } from './useConversation';

export interface UseChatSessionOptions {
  /**
   * Forwarded to the underlying `useConversation`. Fires when
   * /conversations/list returns 403/404 on the docset — caller typically
   * clears the active collection via `useClearActiveCollection`.
   */
  onStaleDocset?: UseConversationOptions['onStaleDocset'];
}

export interface UseChatSessionReturn {
  state: ChatSession;
  dispatch: Dispatch<ChatAction>;
  conversationLoading: boolean;
  conversationError: Error | null;
}

export const useChatSession = (
  documentSetId: string | null,
  options: UseChatSessionOptions = {},
): UseChatSessionReturn | null => {
  const [state, dispatch] = useReducer(
    chatReducer,
    documentSetId ?? '',
    buildInitialChatSession,
  );

  // Reset reducer when the active collection changes (cancels in-flight stream
  // via STREAM_ABORTED inside the reducer).
  useEffect(() => {
    if (!documentSetId) return;
    if (state.documentSetId === documentSetId) return;
    dispatch({ type: 'SET_DOCUMENT_SET', documentSetId });
  }, [documentSetId, state.documentSetId]);

  const { conversationId, isLoading, error } = useConversation(documentSetId, {
    onStaleDocset: options.onStaleDocset,
  });

  // Sync the resolved conversation id from `/list` into the reducer.
  //
  // The effect must not clobber a locally-set `state.conversationId` with
  // `/list`'s stale null — once `useSseChat.ensureConversation` lazy-creates
  // a conversation, the `/list` query is still holding its mount-time
  // cached null until something invalidates it. When `STREAM_ENDED` flips
  // `state.streaming` from non-null back to null, this effect re-runs, and
  // a naive `dispatch(CONVERSATION_RESOLVED, null)` would wipe the freshly
  // created id — the next send would then go through `ensureConversation`
  // again and create a brand-new conversation per message, losing history.
  //
  // Rules:
  //  - if state and /list agree, no-op
  //  - if /list returned null, keep state as-is (`/list` is behind; if the
  //    conversation was truly deleted, the self-heal in `useChatHistory`
  //    handles it via a 404 on `/history`)
  //  - otherwise, sync `/list`'s value into state
  useEffect(() => {
    if (!documentSetId) return;
    if (state.streaming) return;
    if (state.conversationId === conversationId) return;
    if (conversationId === null) return;
    dispatch({ type: 'CONVERSATION_RESOLVED', conversationId });
  }, [conversationId, documentSetId, state.streaming, state.conversationId]);

  if (!documentSetId) return null;

  return {
    state,
    dispatch,
    conversationLoading: isLoading,
    conversationError: error,
  };
};
