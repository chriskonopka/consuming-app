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
import { useConversation } from './useConversation';

export interface UseChatSessionReturn {
  state: ChatSession;
  dispatch: Dispatch<ChatAction>;
  conversationLoading: boolean;
  conversationError: Error | null;
}

export const useChatSession = (documentSetId: string | null): UseChatSessionReturn | null => {
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

  const { conversationId, isLoading, error } = useConversation(documentSetId);

  // Push the resolved conversation id into the reducer once. The reducer
  // ignores no-op transitions, so re-runs are safe.
  useEffect(() => {
    if (!documentSetId) return;
    if (state.streaming) return;
    dispatch({ type: 'CONVERSATION_RESOLVED', conversationId });
  }, [conversationId, documentSetId, state.streaming]);

  if (!documentSetId) return null;

  return {
    state,
    dispatch,
    conversationLoading: isLoading,
    conversationError: error,
  };
};
