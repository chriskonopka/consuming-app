/**
 * What belongs here: inline `[N]` superscript with hover tooltip and click
 * handler that opens the document viewer at the cited page.
 *
 * Scaffolded — implementation lands in slice 4 (Citations + PDF viewer).
 */

import type { Citation } from '@shared/types';

interface Props {
  citation: Citation;
  onOpen: (citation: Citation) => void;
}

export const CitationMarker = ({ citation }: Props) => {
  return <sup aria-label={`Citation ${citation.marker}`}>[{citation.marker}]</sup>;
};
