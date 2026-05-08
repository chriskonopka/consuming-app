/**
 * Reads/writes the `/c/{id}?folderId=&documentId=` URL shape via
 * react-router-dom. Push-state by default so back-button works.
 *
 * Used by features/indexer-host to populate the indexer's `initialState`
 * prop on first mount, and to push URL updates in response to
 * `collection/activated` and `document/selected` events.
 */

import { useCallback, useMemo } from 'react';

import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';

interface UrlState {
  documentSetId: string | null;
  folderId: string | null;
  documentId: string | null;
  pushCollection: (id: string | null) => void;
  pushDocument: (id: string | null) => void;
}

export const useUrlState = (): UrlState => {
  const params = useParams<{ documentSetId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const documentSetId = params.documentSetId ?? null;
  const folderId = searchParams.get('folderId');
  const documentId = searchParams.get('documentId');

  const pushCollection = useCallback(
    (id: string | null) => {
      // Drop folder/document context when collection changes.
      if (id) navigate(`/c/${id}`);
      else navigate('/');
    },
    [navigate],
  );

  const pushDocument = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(searchParams);
      if (id) next.set('documentId', id);
      else next.delete('documentId');
      setSearchParams(next, { replace: false });
    },
    [searchParams, setSearchParams],
  );

  // Memoize so consumers can put this in dep arrays without thrashing.
  return useMemo(
    () => ({
      documentSetId,
      folderId,
      documentId,
      pushCollection,
      pushDocument,
    }),
    // location.key changes on every navigation, ensuring derived values stay fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [documentSetId, folderId, documentId, pushCollection, pushDocument, location.key],
  );
};
