/**
 * Returns a callback the chat panel passes to `<CitationMarker>` and
 * `<SourceList>`. When invoked with a Citation:
 *   1. Use the citation's `documentId` (added to the SSE citation event
 *      2026-05-12) to identify the source document.
 *   2. Open the viewer at the cited page with the highlight rectangle.
 *   3. Call the indexer's `revealDocument(documentId)` so the file list
 *      scrolls to and highlights the document (REQUIREMENTS.md §2.6).
 *
 * `documentId` is nullable on `CitationData` because persisted
 * `MessageCitation` records written before the API change deserialize as
 * `null`. When the documentId is missing we cannot open the viewer (the
 * `/documents/{id}/content` endpoint requires a GUID and `fileName` is not
 * unique); the click becomes a no-op and we record telemetry so we can
 * track how often this hits real users — once those legacy records have
 * been replaced it should drop to zero.
 */

import { useCallback } from 'react';

import type { Citation } from '@shared/types';
import { toCitationRect } from '@shared/types';

import { appInsights } from '../../appInsights';
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
      const { documentId } = citation;
      if (!documentId) {
        // Legacy persisted citation: no documentId means we cannot route
        // to the viewer. Surface to telemetry; the click is a no-op.
        appInsights?.trackEvent({
          name: 'CitationMissingDocumentId',
          properties: { marker: String(citation.marker), page: String(citation.page) },
        });
        return;
      }
      const highlight = toCitationRect(citation);
      viewer.open(documentId, citation.page, highlight);
      indexerRef.current?.revealDocument(documentId);
    },
    [indexerRef, viewer],
  );
};
