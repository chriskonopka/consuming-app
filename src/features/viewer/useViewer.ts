/**
 * What belongs here: viewer state reducer (open document, current page,
 * highlight rectangle, drift-guard verdict) plus the `open(documentId, page,
 * highlight?)` action other features call.
 *
 * Scaffolded — implementation lands in slice 4 (state + PDF) and slice 5 (image).
 */

import type { ViewerState } from '@shared/types';

interface UseViewerReturn {
  state: ViewerState;
  open: (documentId: string, page: number) => void;
  close: () => void;
}

export const useViewer = (): UseViewerReturn => {
  return {
    state: {
      open: null,
      pageRenderState: 'loading',
      totalPages: 0,
      driftGuardFired: false,
    },
    open: () => {
      // slice 4
    },
    close: () => {
      // slice 4
    },
  };
};
