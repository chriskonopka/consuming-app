/**
 * Citation rendering and audit types — owned by features/citations.
 *
 * The API resolves citation coordinates server-side (CitationBuilderSkill).
 * This module:
 *   - Renders [N] markers from citations attached to a message
 *   - Audits citations for missing coordinates (drift guard runs in features/viewer)
 *   - Groups citations into one source-list row per (document, page)
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
 * One entry per (document, page) for the source-list panel.
 *
 * Multiple line-level citations that land on the same page of the same document
 * collapse into a single row. They paint different lines of one page, so listing
 * each as its own "source" reads as duplicate noise (a scanned form page with 20
 * cited lines would otherwise produce 20 near-identical rows). The inline [N]
 * badges in the answer text stay 1:1 with citations and keep per-line precision —
 * this panel is a deduped index of where the answer drew from, not a mirror of
 * every marker.
 *
 * Identity is the documentId when present; fileName is display-only and can
 * collide across DocumentSets or be renamed, so two same-named documents must
 * not merge. Citations persisted before the documentId field existed
 * (pre-2026-05-12) fall back to fileName. `representative` is the first citation
 * seen for the group — callers sort by marker beforehand, so it is the
 * lowest-numbered citation on that page and the viewer target on row click.
 */
export interface SourcePageGroup {
  /** Stable per-group identity: `${documentId ?? fileName}#${page}`. */
  key: string;
  fileName: string;
  page: number;
  representative: Citation;
  /** Number of distinct citations collapsed into this row (>= 1). */
  count: number;
}

export const groupCitationsByPage = (citations: ReadonlyArray<Citation>): SourcePageGroup[] => {
  const groups = new Map<string, SourcePageGroup>();
  for (const citation of citations) {
    const identity = citation.documentId ?? citation.fileName;
    const key = `${identity}#${citation.page}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(key, {
        key,
        fileName: citation.fileName,
        page: citation.page,
        representative: citation,
        count: 1,
      });
    }
  }
  return [...groups.values()];
};
