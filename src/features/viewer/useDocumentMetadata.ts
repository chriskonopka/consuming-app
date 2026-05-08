/**
 * Loads document metadata (`GET /documents/{id}`) for the viewer header —
 * fileName, fileType, contentType, fileSizeBytes, createdAt.
 *
 * Server-authoritative + immutable post-upload, so a generous staleTime is
 * fine (api-contracts.md §2 / data-model.md §1).
 */

import { useQuery } from '@tanstack/react-query';

import type { DocumentMetadataResponse } from '@shared/types';

import { useApiClient } from '../../hooks/useApiClient';

import { viewerQueryKeys } from './queryKeys';

const STALE_TIME_MS = 5 * 60 * 1000;

interface UseDocumentMetadataReturn {
  data: DocumentMetadataResponse | null;
  isLoading: boolean;
  isError: boolean;
}

export const useDocumentMetadata = (
  documentId: string | null,
): UseDocumentMetadataReturn => {
  const api = useApiClient();
  const query = useQuery({
    queryKey: documentId ? viewerQueryKeys.document(documentId) : ['viewer-noop'],
    enabled: documentId !== null,
    staleTime: STALE_TIME_MS,
    // encodeURIComponent on the path segment as defense-in-depth — the
    // documentId (citation.fileName in v1) traverses through an LLM response.
    queryFn: () => {
      // queryFn only runs when enabled, so documentId is non-null here;
      // narrowing prevents the unnecessary `as string` cast.
      if (documentId === null) {
        throw new Error('useDocumentMetadata queryFn called without documentId');
      }
      return api.get<DocumentMetadataResponse>(
        `/documents/${encodeURIComponent(documentId)}`,
      );
    },
  });
  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  };
};
