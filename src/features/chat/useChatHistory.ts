/**
 * Loads the full message history for a conversation.
 *
 * Per REQUIREMENTS.md §4.7, history is server-authoritative; we never mirror
 * messages to IndexedDB. The body is `{}` (full load — no pagination) per
 * api-contracts.md §2.2.
 *
 * TanStack Query caches per (documentSetId, conversationId). After every
 * assistant response completes, `useSseChat` invalidates this query so the
 * next render reads the persisted thread.
 *
 * Stale-state self-heal: if the API returns 404 we fire `onStaleConversation`
 * once and swallow the error from the public surface — the cached
 * `conversationId` is referring to a conversation that was deleted (admin
 * action, test-tenant wipe, etc.). Callers drop the cached id and let the
 * next message send lazy-create a fresh conversation. 403 on the docset is
 * handled by `onStaleDocset` separately because the recovery is different
 * (clear the active collection rather than just the conversation).
 */

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { ConversationHistoryResponse, LocalMessage } from '@shared/types';
import { toLocalMessage } from '@shared/types';

import { useApiClient, ApiError } from '../../hooks/useApiClient';

import { chatQueryKeys } from './queryKeys';

export interface ChatHistoryOptions {
  /** Fired once when the history endpoint returns 404 (conversation gone). */
  onStaleConversation?: () => void;
  /** Fired once when the history endpoint returns 403 (docset access lost). */
  onStaleDocset?: () => void;
}

export interface ChatHistoryResult {
  messages: ReadonlyArray<LocalMessage>;
  isLoading: boolean;
  error: Error | null;
}

export const useChatHistory = (
  documentSetId: string | null,
  conversationId: string | null,
  options: ChatHistoryOptions = {},
): ChatHistoryResult => {
  const api = useApiClient();
  const enabled = documentSetId !== null && conversationId !== null;

  const query = useQuery<ConversationHistoryResponse>({
    queryKey: enabled
      ? chatQueryKeys.history(documentSetId, conversationId)
      : ['chat', 'history', null, null],
    enabled,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    queryFn: () =>
      api.post<ConversationHistoryResponse>(
        `/document-sets/${documentSetId}/conversations/${conversationId}/history`,
        {},
      ),
  });

  const { onStaleConversation, onStaleDocset } = options;
  const apiError = query.error instanceof ApiError ? query.error : null;
  const isStaleConversation = apiError?.status === 404;
  const isStaleDocset = apiError?.status === 403;

  useEffect(() => {
    if (isStaleConversation) onStaleConversation?.();
  }, [isStaleConversation, onStaleConversation]);
  useEffect(() => {
    if (isStaleDocset) onStaleDocset?.();
  }, [isStaleDocset, onStaleDocset]);

  const messages = query.data?.messages.map(toLocalMessage) ?? [];

  return {
    messages,
    isLoading: query.isLoading,
    // Suppress 403/404 from the public error surface — the recovery callbacks
    // own the response and the UI should not also show a generic error.
    error:
      apiError && (apiError.status === 403 || apiError.status === 404)
        ? null
        : query.error instanceof Error
          ? query.error
          : null,
  };
};
