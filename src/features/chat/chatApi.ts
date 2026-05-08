/**
 * Thin wrappers over the chat / conversation HTTP endpoints. Pure functions
 * over an ApiClient instance; features wrap them with TanStack Query hooks.
 *
 * Spec: REQUIREMENTS.md §4 + the API's frontend-api-contract.md.
 */

import type {
  ConversationHistoryResponse,
  ConversationResponse,
  ConversationSummary,
  Paged,
} from '@shared/types';

import type { ApiClient } from '../../hooks/useApiClient';

/**
 * Find the user's most recent conversation for a collection (page=1, size=1).
 * Returns null if the user has no conversations yet.
 */
export const findCurrentConversation = async (
  client: ApiClient,
  documentSetId: string,
): Promise<ConversationSummary | null> => {
  const result = await client.post<Paged<ConversationSummary>>(
    `/document-sets/${encodeURIComponent(documentSetId)}/conversations/list`,
    { page: 1, pageSize: 1 },
  );
  return result.items[0] ?? null;
};

/** Lazy-create a conversation on first user message. */
export const createConversation = (
  client: ApiClient,
  documentSetId: string,
  title: string,
): Promise<ConversationResponse> =>
  client.post<ConversationResponse>(
    `/document-sets/${encodeURIComponent(documentSetId)}/conversations`,
    { title },
  );

/** Delete a conversation. Used by the Clear button. */
export const deleteConversation = (
  client: ApiClient,
  conversationId: string,
): Promise<void> =>
  client.del<void>(`/conversations/${encodeURIComponent(conversationId)}`);

/** Load full message history for a conversation. */
export const loadHistory = (
  client: ApiClient,
  documentSetId: string,
  conversationId: string,
): Promise<ConversationHistoryResponse> =>
  client.post<ConversationHistoryResponse>(
    `/document-sets/${encodeURIComponent(documentSetId)}/conversations/${encodeURIComponent(conversationId)}/history`,
    {},
  );

export interface SendMessageBody {
  content: string;
  llmProvider: 'Claude' | 'OpenAi';
}

/**
 * The path for `POST /document-sets/{id}/conversations/{convId}/messages`.
 * Returns just the path; useSseChat wraps it in a fetch with
 * `Accept: text/event-stream`.
 */
export const messageStreamPath = (
  documentSetId: string,
  conversationId: string,
): string =>
  `/document-sets/${encodeURIComponent(documentSetId)}/conversations/${encodeURIComponent(conversationId)}/messages`;
