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
 *
 * Stale-state self-heal: 403/404 on the docset means the cached
 * `documentSetId` is no longer accessible (admin delete, share revoke,
 * tenant wipe). Fire `onStaleDocset` so the caller can clear the active
 * collection rather than surfacing a generic error to the user.
 */

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { ConversationSummary, Paged } from '@shared/types';

import { useApiClient, ApiError } from '../../hooks/useApiClient';

import { chatQueryKeys } from './queryKeys';

export interface UseConversationOptions {
  /** Fired once when /conversations/list returns 403 or 404 on the docset. */
  onStaleDocset?: () => void;
}

export interface ConversationResolution {
  conversationId: string | null;
  isLoading: boolean;
  error: Error | null;
}

export const useConversation = (
  documentSetId: string | null,
  options: UseConversationOptions = {},
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

  const { onStaleDocset } = options;
  const apiError = query.error instanceof ApiError ? query.error : null;
  const isStaleDocset = apiError?.status === 403 || apiError?.status === 404;

  useEffect(() => {
    if (isStaleDocset) onStaleDocset?.();
  }, [isStaleDocset, onStaleDocset]);

  return {
    conversationId: query.data?.items[0]?.conversationId ?? null,
    isLoading: query.isLoading,
    // Hide 403/404 from the public error surface — recovery is owned by the
    // caller via onStaleDocset and the UI should not show a generic error.
    error: isStaleDocset
      ? null
      : query.error instanceof Error
        ? query.error
        : null,
  };
};
