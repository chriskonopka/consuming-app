/**
 * Citation rendering and audit types — owned by features/citations.
 *
 * The API resolves citation coordinates server-side (CitationBuilderSkill).
 * This module:
 *   - Renders [N] markers from citations attached to a message
 *   - Audits citations for missing coordinates (drift guard runs in features/viewer)
 *   - Groups citations into one source-list entry per cited document
 */

import type { CitationData } from './api-dtos';

/** Same shape as the API's CitationData; aliased here for module-local clarity. */
export type Citation = CitationData;

/**
 * Audit verdict applied per citation before render.
 * Drift-guard verdicts (geometry-based) live on ViewerState — see viewer.ts —
 * because they can only be resolved after pdf.js reports the page dimensions.
 */
export type CitationAuditStatus = 'verified' | 'missing-coords';

export interface AuditedCitation extends Citation {
  audit: CitationAuditStatus;
}

/**
 * Audit a citation for missing coordinates. The API silently discards
 * hallucinated [cite:N] markers, so we don't re-verify text content. We only
 * catch the rare "all zeros / negatives" case.
 */
export const auditCitation = (c: Citation): AuditedCitation => {
  const hasCoords = c.x > 0 && c.y > 0 && c.w > 0 && c.h > 0;
  return { ...c, audit: hasCoords ? 'verified' : 'missing-coords' };
};

/**
 * One entry per cited document for the source-list panel.
 *
 * Every line-level citation in a document is grouped under a single header that
 * shows the file name once. The panel reveals the individual passages as [N]
 * links on expand, each opening the viewer at that citation's exact line — so a
 * heavily-cited document (a scanned form cited on 20 lines) reads as one entry
 * that opens up to its lines, not as 20 near-identical rows. The inline [N]
 * badges in the answer text stay 1:1 with citations and keep per-line precision;
 * this panel is the grouped index of where the answer drew from.
 *
 * Identity is the documentId when present; fileName is display-only and can
 * collide across DocumentSets or be renamed, so two same-named documents must
 * not merge. Citations persisted before the documentId field existed
 * (pre-2026-05-12) fall back to fileName. `citations` preserve input order —
 * callers sort by marker beforehand, so they read in inline-marker order.
 */
export interface SourceDocumentGroup {
  /** Stable per-document identity: `documentId ?? fileName`. */
  key: string;
  fileName: string;
  /** Every citation in this document, in caller-provided (marker) order. */
  citations: Citation[];
}

export const groupCitationsByDocument = (
  citations: ReadonlyArray<Citation>,
): SourceDocumentGroup[] => {
  const groups = new Map<string, SourceDocumentGroup>();
  for (const citation of citations) {
    const identity = citation.documentId ?? citation.fileName;
    const existing = groups.get(identity);
    if (existing) {
      existing.citations.push(citation);
    } else {
      groups.set(identity, {
        key: identity,
        fileName: citation.fileName,
        citations: [citation],
      });
    }
  }
  return [...groups.values()];
};
