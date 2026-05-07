/**
 * Citation rendering and audit types — owned by features/citations.
 *
 * The API resolves citation coordinates server-side (CitationBuilderSkill).
 * This module:
 *   - Renders [N] markers from citations attached to a message
 *   - Audits citations for missing coordinates (drift guard runs in features/viewer)
 *   - Provides the source-list grouping/dedupe by fileName
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
 * Group citations by fileName for the source-list UI.
 * Each source lists the unique pages (sorted) where the file is cited.
 */
export interface SourceGroup {
  fileName: string;
  pages: number[]; // sorted, deduped
  firstCitation: Citation; // for click → open viewer at this page
}

export const groupCitationsBySource = (citations: Citation[]): SourceGroup[] => {
  const map = new Map<string, SourceGroup>();
  for (const citation of citations) {
    const existing = map.get(citation.fileName);
    if (existing) {
      if (!existing.pages.includes(citation.page)) {
        existing.pages.push(citation.page);
        existing.pages.sort((pageA, pageB) => pageA - pageB);
      }
    } else {
      map.set(citation.fileName, {
        fileName: citation.fileName,
        pages: [citation.page],
        firstCitation: citation,
      });
    }
  }
  return [...map.values()];
};
