/**
 * Inline `[N]` superscript citation marker. Renders as a `<button>` (per
 * `web-accessibility.md`) with a hover/focus tooltip and a click handler that
 * the parent supplies (see `useCitationClick`).
 *
 * Audit (REQUIREMENTS.md §5.2):
 *   - Coords missing → strike-through + "Unverified — coordinates missing".
 *   - Coords present → "{fileName}, page {page}".
 *
 * Geometry-based drift-guard verdicts (>100% page height) are evaluated in the
 * viewer once pdf.js reports page dimensions; that case is rendered there as
 * a "Couldn't locate this quote" banner, not on the marker.
 */

import type { Citation } from '@shared/types';
import { auditCitation } from '@shared/types';

import { Tooltip } from '../../components/Tooltip';

import styles from './CitationMarker.module.scss';

interface Props {
  citation: Citation;
  onOpen: (citation: Citation) => void;
}

export const CitationMarker = ({ citation, onOpen }: Props) => {
  const audited = auditCitation(citation);
  const unverified = audited.audit === 'missing-coords';
  const tooltip = unverified
    ? 'Unverified — coordinates missing'
    : `${citation.fileName}, page ${citation.page}`;

  return (
    <Tooltip content={tooltip}>
      <button
        type="button"
        className={`${styles.marker} ${unverified ? styles.unverified : ''}`}
        aria-label={`Citation ${citation.marker} — ${tooltip}`}
        onClick={() => onOpen(citation)}
      >
        [{citation.marker}]
      </button>
    </Tooltip>
  );
};
