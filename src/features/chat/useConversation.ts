/**
 * Resolves the current conversation id for an active collection.
 *
 * Per REQUIREMENTS.md §4.1, the consuming app surfaces a single auto-managed
 * conversation per (user, collection):
 *   - On `collection/activated`, fetch page 1, pageSize 1.
 *   - If a conversation exists, treat its id as current and load history.
 *   - If none exists, lazy-create on first send (handled in useSseChat).
 *
 * `staleTime: 0` per data-model.md — re-fetch on every collection change so a
 * server-side delete/clear from another tab is reflected.
 */

import { useQuery } from '@tanstack/react-query';

import type { ConversationSummary, Paged } from '@shared/types';

import { useApiClient } from '../../hooks/useApiClient';

import { chatQueryKeys } from './queryKeys';

export interface ConversationResolution {
  conversationId: string | null;
  isLoading: boolean;
  error: Error | null;
}

export const useConversation = (
  documentSetId: string | null,
): ConversationResolution => {
  const api = useApiClient();
  const enabled = documentSetId !== null;

  const query = useQuery<Paged<ConversationSummary>>({
    queryKey: enabled ? chatQueryKeys.conversation(documentSetId) : ['chat', 'conversation', null],
    enabled,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    queryFn: () =>
      api.post<Paged<ConversationSummary>>(
        `/document-sets/${documentSetId}/conversations/list`,
        { page: 1, pageSize: 1 },
      ),
  });

  return {
    conversationId: query.data?.items[0]?.conversationId ?? null,
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error : null,
  };
};
