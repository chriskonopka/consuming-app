/**
 * Source list shown beneath each completed assistant message.
 *
 * One row per citation, ordered ascending by `marker`, so the panel
 * order matches the inline `[N]` markers in the answer text. Each row
 * is independently clickable to the same viewer target the inline
 * marker uses — keyed by `documentId` (never `fileName`, which is
 * display-only and can collide across DocumentSets).
 *
 * Earlier versions grouped citations by `fileName` with deduped pages,
 * which created a misleading impression that marker `[N]` mapped to
 * the Nth page in the first group. The new layout is a flat list with
 * the `[N]` chip alongside the file name + page, so the relationship
 * between an inline marker and its panel row is unambiguous.
 *
 * Markers are unique per response (the API's `CitationMarkerDetector`
 * dedupes server-side), so there's no client-side dedup here.
 */

import { useMemo, useState } from 'react';
import { CaretDown, CaretRight } from '@phosphor-icons/react';

import type { Citation } from '@shared/types';

import styles from './SourceList.module.scss';

interface Props {
  citations: ReadonlyArray<Citation>;
  onOpen: (citation: Citation) => void;
}

export const SourceList = ({ citations, onOpen }: Props) => {
  const [expanded, setExpanded] = useState(false);

  // Sort by marker so the row order matches the order the markers appear
  // in the answer text. The server emits markers sequentially per response,
  // so this is normally already in order — sort defensively in case a
  // future API change emits them out of order.
  const ordered = useMemo(
    () => [...citations].sort((markerA, markerB) => markerA.marker - markerB.marker),
    [citations],
  );

  if (ordered.length === 0) return null;

  const total = ordered.length;
  const label = `${total} ${total === 1 ? 'source' : 'sources'}`;

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? (
          <CaretDown size={16} weight="regular" aria-hidden="true" focusable="false" />
        ) : (
          <CaretRight size={16} weight="regular" aria-hidden="true" focusable="false" />
        )}
        <span>{expanded ? 'Hide sources' : `View ${label}`}</span>
      </button>
      {expanded && (
        <ul className={styles.list} aria-label="Cited sources">
          {ordered.map((citation) => (
            <li key={citation.marker} className={styles.item}>
              <button
                type="button"
                className={styles.source}
                onClick={() => onOpen(citation)}
                aria-label={`Citation ${citation.marker} — ${citation.fileName}, page ${citation.page}`}
              >
                <span className={styles.marker} aria-hidden="true">
                  [{citation.marker}]
                </span>
                <span className={styles.fileName} title={citation.fileName}>
                  {citation.fileName}
                </span>
                <span className={styles.page} aria-hidden="true">
                  p{citation.page}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
