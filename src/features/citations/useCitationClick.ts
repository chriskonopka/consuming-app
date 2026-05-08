/**
 * Returns a callback the chat panel passes to `<CitationMarker>` and
 * `<SourceList>`. When invoked with a Citation:
 *   1. Resolve the documentId from the active collection (citations carry
 *      `fileName` only — see REQUIREMENTS.md §5.1; the API resolves the rest
 *      via `revealDocument`).
 *   2. Open the viewer at the cited page with the highlight rectangle.
 *   3. Call the indexer's `revealDocument(documentId)` so the file list
 *      scrolls to and highlights the document (REQUIREMENTS.md §2.6).
 *
 * Citations on the API include `fileName` but not `documentId`. The viewer
 * looks up the doc by fileName via a `revealDocument` round-trip on the
 * indexer side. Until the indexer's contract carries documentId on its
 * citations, we use `fileName` as the viewer's identifier — pdf.js then
 * resolves the content via `GET /documents/{id}` once revealDocument confirms.
 *
 * For v1 the citation's documentId is the fileName itself (matches what
 * `<DocumentViewer>` expects in `state.open.documentId`); the indexer's
 * `revealDocument` is a best-effort no-op when the document isn't in the
 * active collection.
 */

import { useCallback } from 'react';

import type { Citation } from '@shared/types';
import { toCitationRect } from '@shared/types';

import { useIndexerRef } from '../indexer-host';
// Import directly from ViewerContext (not the feature barrel) so consumers of
// citations don't pull DocumentViewer + its msalInstance dependency chain
// into unit-test module graphs.
import { useViewer } from '../viewer/ViewerContext';

export const useCitationClick = (): ((citation: Citation) => void) => {
  const indexerRef = useIndexerRef();
  const viewer = useViewer();

  return useCallback(
    (citation: Citation) => {
      const documentId = citation.fileName;
      const highlight = toCitationRect(citation);
      viewer.open(documentId, citation.page, highlight);
      indexerRef.current?.revealDocument(documentId);
    },
    [indexerRef, viewer],
  );
};
