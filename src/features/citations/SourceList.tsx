/**
 * What belongs here: "View N sources" expander listing each unique source
 * file (grouped via groupCitationsBySource) with the cited pages and a
 * click handler that opens the viewer at the first cited page.
 *
 * Scaffolded — implementation lands in slice 4.
 */

import type { Citation } from '@shared/types';

interface Props {
  citations: Citation[];
  onOpen: (citation: Citation) => void;
}

export const SourceList = ({ citations }: Props) => {
  if (citations.length === 0) return null;
  return <div>Source list — wired in slice 4.</div>;
};
