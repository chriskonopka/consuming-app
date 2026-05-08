/**
 * Resolves the current conversation for a collection, or signals that one
 * needs to be lazy-created on first send.
 *
 * Per REQUIREMENTS.md §4.1: page=1/size=1 query against `/conversations/list`.
 * If a conversation exists, treat its id as current. If none, defer creation
 * until first send.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiClient } from '../../hooks/useApiClient';

import {
  createConversation,
  deleteConversation,
  findCurrentConversation,
} from './chatApi';

export const conversationQueryKey = (documentSetId: string) =>
  ['conversation', 'current', documentSetId] as const;

export const useCurrentConversation = (documentSetId: string | null) => {
  const client = useApiClient();
  return useQuery({
    queryKey: documentSetId
      ? conversationQueryKey(documentSetId)
      : ['conversation', 'current', 'none'],
    queryFn: async () => {
      if (!documentSetId) return null;
      return await findCurrentConversation(client, documentSetId);
    },
    enabled: documentSetId !== null,
    staleTime: 30_000,
  });
};

export const useCreateConversation = () => {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      documentSetId,
      title,
    }: {
      documentSetId: string;
      title: string;
    }) => createConversation(client, documentSetId, title),
    onSuccess: (data) => {
      queryClient.setQueryData(conversationQueryKey(data.documentSetId), {
        conversationId: data.conversationId,
        title: data.title,
        messageCount: data.messageCount,
        lastMessageAt: data.lastMessageAt,
      });
    },
  });
};

export const useDeleteConversation = () => {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      conversationId,
    }: {
      conversationId: string;
      documentSetId: string;
    }) => deleteConversation(client, conversationId),
    onSuccess: (_, vars) => {
      queryClient.setQueryData(conversationQueryKey(vars.documentSetId), null);
      queryClient.invalidateQueries({
        queryKey: ['chat', 'history', vars.conversationId],
      });
    },
  });
};
