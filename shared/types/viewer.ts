/**
 * Document viewer state — owned by features/viewer.
 */

import type { Citation } from './citation';

export type PageRenderState = 'loading' | 'rendering' | 'rendered' | 'error';

/** A citation rectangle ready for overlay drawing — PDF points, origin top-left. */
export interface CitationRect {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  fileName: string;
  marker: number;
}

export const toCitationRect = (citation: Citation): CitationRect => ({
  page: citation.page,
  x: citation.x,
  y: citation.y,
  w: citation.w,
  h: citation.h,
  fileName: citation.fileName,
  marker: citation.marker,
});

export interface OpenDocument {
  documentId: string;
  page: number;
  highlight: CitationRect | null;
}

export interface ViewerState {
  open: OpenDocument | null;
  pageRenderState: PageRenderState;
  /** Total pages — set after pdf.js loads the document. */
  totalPages: number;
  /**
   * True when the drift guard rejected the highlight (covers > 25% of page
   * height). Triggers the "Couldn't locate this quote" banner.
   */
  driftGuardFired: boolean;
}

/**
 * Drift guard threshold — REQUIREMENTS.md §5.2 / §5.6.
 * Reject highlights covering more than this fraction of the visible page height.
 *
 * Raised from 0.25 → 0.50 on 2026-05-13. The API's citation builder consistently
 * returns rectangles spanning whole content blocks rather than tight snippet
 * bounds; 0.25 was rejecting most real citations as if they were misaligned
 * coordinates. 0.50 still catches the genuinely broken "whole page" case
 * (>50%) while letting section-sized rectangles render.
 */
export const DRIFT_GUARD_MAX_PAGE_FRACTION = 0.5;

/**
 * Result of running the drift guard.
 * Caller renders the rect on 'render', shows "Couldn't locate" on 'reject'.
 */
export type DriftGuardVerdict = 'render' | 'reject';

export const driftGuard = (
  rectHeight: number,
  pageHeight: number,
): DriftGuardVerdict => {
  if (pageHeight <= 0) return 'reject';
  return rectHeight / pageHeight <= DRIFT_GUARD_MAX_PAGE_FRACTION ? 'render' : 'reject';
};
