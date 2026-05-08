/**
 * Reducer for the document viewer's local state. Owned by `features/viewer/`.
 *
 * Action shapes mirror the user-visible operations the viewer supports:
 *   - OPEN — open a document (optionally at a page/highlight) — clicked from
 *     chat citation, source list, or indexer `document/selected` event.
 *   - CLOSE — user closed the panel (Escape, close button, or backdrop click).
 *   - SET_PAGE — page-nav UI (prev/next, numeric input, PageUp/Down).
 *   - SET_RENDER_STATE — pdf.js render lifecycle: loading → rendering → rendered/error.
 *   - SET_TOTAL_PAGES — emitted after pdf.js loads the document.
 *   - SET_DRIFT_GUARD — drift-guard verdict on the current highlight.
 *
 * Pure: no React, no fetches. Wires straight into `useReducer`.
 */

import type { CitationRect, ViewerState, PageRenderState } from '@shared/types';

export type ViewerAction =
  | { type: 'OPEN'; documentId: string; page: number; highlight: CitationRect | null }
  | { type: 'CLOSE' }
  | { type: 'SET_PAGE'; page: number }
  | { type: 'SET_RENDER_STATE'; renderState: PageRenderState }
  | { type: 'SET_TOTAL_PAGES'; totalPages: number }
  | { type: 'SET_DRIFT_GUARD'; fired: boolean };

export const INITIAL_VIEWER_STATE: ViewerState = {
  open: null,
  pageRenderState: 'loading',
  totalPages: 0,
  driftGuardFired: false,
};

export const viewerReducer = (state: ViewerState, action: ViewerAction): ViewerState => {
  switch (action.type) {
    case 'OPEN': {
      // If we're opening a different document, reset the loaded-document
      // state (totalPages, render state). Same document → page or highlight
      // change only.
      const sameDoc = state.open?.documentId === action.documentId;
      return {
        ...state,
        open: {
          documentId: action.documentId,
          page: action.page,
          highlight: action.highlight,
        },
        pageRenderState: sameDoc ? state.pageRenderState : 'loading',
        totalPages: sameDoc ? state.totalPages : 0,
        driftGuardFired: false,
      };
    }
    case 'CLOSE':
      return { ...INITIAL_VIEWER_STATE };
    case 'SET_PAGE': {
      if (!state.open) return state;
      // Page change clears any prior highlight — only the OPEN action attaches a highlight.
      return {
        ...state,
        open: { ...state.open, page: action.page, highlight: null },
        driftGuardFired: false,
      };
    }
    case 'SET_RENDER_STATE':
      return { ...state, pageRenderState: action.renderState };
    case 'SET_TOTAL_PAGES':
      return { ...state, totalPages: action.totalPages };
    case 'SET_DRIFT_GUARD':
      return { ...state, driftGuardFired: action.fired };
  }
};
