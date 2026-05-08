/**
 * Fetches and caches the message history for a conversation. TanStack Query
 * with staleTime=0 + manual invalidation after each assistant response.
 *
 * Per REQUIREMENTS.md §4.7.
 */

import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../hooks/useApiClient';

import { loadHistory } from './chatApi';

export const historyQueryKey = (conversationId: string) =>
  ['chat', 'history', conversationId] as const;

export const useChatHistory = (
  documentSetId: string | null,
  conversationId: string | null,
) => {
  const client = useApiClient();
  return useQuery({
    queryKey: conversationId
      ? historyQueryKey(conversationId)
      : ['chat', 'history', 'none'],
    queryFn: async () => {
      if (!documentSetId || !conversationId) {
        return { conversationId: '', totalMessages: 0, messages: [], etag: '' };
      }
      return await loadHistory(client, documentSetId, conversationId);
    },
    enabled: documentSetId !== null && conversationId !== null,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  });
};
