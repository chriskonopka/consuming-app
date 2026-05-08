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
 */

import { useQuery } from '@tanstack/react-query';

import type { ConversationHistoryResponse, LocalMessage } from '@shared/types';
import { toLocalMessage } from '@shared/types';

import { useApiClient } from '../../hooks/useApiClient';

import { chatQueryKeys } from './queryKeys';

export interface ChatHistoryResult {
  messages: ReadonlyArray<LocalMessage>;
  isLoading: boolean;
  error: Error | null;
}

export const useChatHistory = (
  documentSetId: string | null,
  conversationId: string | null,
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

  const messages = query.data?.messages.map(toLocalMessage) ?? [];

  return {
    messages,
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error : null,
  };
};
