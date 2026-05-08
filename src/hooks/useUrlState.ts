/**
 * Reads/writes the `/c/{documentSetId}?folderId=&documentId=` URL shape.
 * Push-state by default so the browser back-button restores prior collections.
 *
 * Uses `useMatch('/c/:documentSetId')` rather than `useParams()` so the
 * `<AppShell>` can stay mounted under a single catch-all route — switching
 * between `/` and `/c/{id}` does not unmount the shell or the lazy-loaded
 * indexer chunk. See `bootstrap.tsx`.
 *
 * Implementation uses react-router-dom@7 — `useMatch` for the path segment,
 * `useSearchParams` for query string, `useNavigate` for push-state.
 */

import { useCallback } from 'react';
import { useMatch, useNavigate, useSearchParams } from 'react-router-dom';

export interface UrlState {
  documentSetId: string | null;
  folderId: string | null;
  documentId: string | null;
  pushCollection: (id: string | null) => void;
  pushDocument: (id: string | null) => void;
}

const COLLECTION_ROUTE_PATTERN = '/c/:documentSetId';

const buildCollectionPath = (
  id: string | null,
  searchParams: URLSearchParams,
): string => {
  if (id === null) {
    // Drop folder/document context on collection clear — they only make sense
    // within a collection scope.
    return '/';
  }
  // Defense-in-depth: the host contract emits GUID document-set ids, but
  // encoding here protects against a compromised remote sending values that
  // could traverse the path or smuggle a query string.
  const safeId = encodeURIComponent(id);
  const queryString = searchParams.toString();
  return queryString ? `/c/${safeId}?${queryString}` : `/c/${safeId}`;
};

export const useUrlState = (): UrlState => {
  const match = useMatch(COLLECTION_ROUTE_PATTERN);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const documentSetId = match?.params.documentSetId ?? null;
  const folderId = searchParams.get('folderId');
  const documentId = searchParams.get('documentId');

  const pushCollection = useCallback(
    (id: string | null) => {
      // Replace search params with an empty set when changing collection —
      // folder/document context never carries across a collection switch.
      navigate(buildCollectionPath(id, new URLSearchParams()));
    },
    [navigate],
  );

  const pushDocument = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(searchParams);
      if (id === null) {
        next.delete('documentId');
      } else {
        next.set('documentId', id);
      }
      setSearchParams(next, { replace: false });
    },
    [searchParams, setSearchParams],
  );

  return { documentSetId, folderId, documentId, pushCollection, pushDocument };
};
