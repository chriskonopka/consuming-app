/**
 * TanStack Query keys for the viewer feature.
 */

export const viewerQueryKeys = {
  all: ['viewer'] as const,
  document: (documentId: string) => [...viewerQueryKeys.all, 'document', documentId] as const,
};
