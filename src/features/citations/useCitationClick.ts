/**
 * What belongs here: returns a callback that, when invoked with a Citation,
 * opens the document viewer at the cited page AND calls the indexer ref's
 * `revealDocument(documentId)` so the file list scrolls into view.
 *
 * Scaffolded — implementation lands in slice 4.
 */

import type { Citation } from '@shared/types';

export const useCitationClick = (): ((citation: Citation) => void) => {
  return () => {
    // slice 4
  };
};
