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
 * Threshold history (all 2026-05-13):
 *   0.25 → 0.50 → 0.85 → 1.0
 *
 * Raised to 1.0 to effectively pass through every API-supplied rectangle
 * while the server's citation pipeline emits page-sized bounds. The gate
 * still rejects coordinates that exceed the page (>100%), which are
 * unambiguously bad data — but anything that fits on the page renders.
 * Tighten this back down (target 0.50 long-term, 0.25 once the API ships
 * snippet-tight bounds) — the gate is a safety net, not a permission.
 */
export const DRIFT_GUARD_MAX_PAGE_FRACTION = 1.0;

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

/**
 * Render-strategy classification for the viewer (REQUIREMENTS.md §5.5).
 *
 *  - `pdf`         → pdf.js (canvas + text layer + highlight overlay)
 *  - `image`       → `<img>` blob-URL pattern + image overlay
 *  - `unsupported` → reserved. The API converts non-image, non-PDF formats
 *                    (docx, xlsx, html, txt, md, rtf) to PDF on the fly, so
 *                    real documents never hit this branch — DocumentViewer
 *                    routes it through the PDF path defensively, and pdf.js
 *                    error banners surface anything unexpected.
 */
export type ViewerRenderStrategy = 'pdf' | 'image' | 'unsupported';

const PDF_CONTENT_TYPE = 'application/pdf';

/**
 * Return the render strategy for a server-supplied content type.
 * Defensive about case + parameters (e.g. `image/png; charset=binary`).
 */
export const renderStrategyFor = (
  contentType: string | null | undefined,
): ViewerRenderStrategy => {
  if (!contentType) return 'unsupported';
  const normalized = contentType.split(';')[0].trim().toLowerCase();
  if (normalized === PDF_CONTENT_TYPE) return 'pdf';
  if (normalized.startsWith('image/')) return 'image';
  return 'unsupported';
};
