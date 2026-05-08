/**
 * Centralised TanStack Query keys for the chat feature. Co-located so cache
 * invalidation in `useSseChat` stays in lock-step with the queries that read
 * the same shape.
 */

export const chatQueryKeys = {
  conversation: (documentSetId: string) =>
    ['chat', 'conversation', documentSetId] as const,
  history: (documentSetId: string, conversationId: string) =>
    ['chat', 'history', documentSetId, conversationId] as const,
};
