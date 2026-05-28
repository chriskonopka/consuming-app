/**
 * Source list shown beneath each completed assistant message.
 *
 * One row per (document, page): every line-level citation that lands on the same
 * page of the same document collapses into a single row. A heavily-cited page
 * (e.g. 20 cited lines on page 1 of a scanned form) would otherwise fill the
 * panel with rows that look identical — same file, same page — and read as
 * duplicates. Collapsing by page removes that noise; a row carries a passage
 * count when it stands for more than one citation.
 *
 * Precision is not lost: the inline [N] badges in the answer text stay 1:1 with
 * citations, each opening its exact line. This panel is a deduped index of where
 * the answer drew from. Clicking a row opens the viewer at that page's first
 * cited line (the group representative).
 *
 * Identity is keyed by documentId, never fileName (display-only — it can collide
 * across DocumentSets and be renamed); see `groupCitationsByPage`.
 */

import { useMemo, useState } from 'react';
import { CaretDown, CaretRight } from '@phosphor-icons/react';

import type { Citation } from '@shared/types';
import { groupCitationsByPage } from '@shared/types';

import styles from './SourceList.module.scss';

interface Props {
  citations: ReadonlyArray<Citation>;
  onOpen: (citation: Citation) => void;
}

export const SourceList = ({ citations, onOpen }: Props) => {
  const [expanded, setExpanded] = useState(false);

  // Sort by marker first so groups appear in the order their first marker shows
  // up in the answer text, then collapse to one row per (document, page). The
  // server emits markers sequentially per response, so the sort is normally a
  // no-op — sort defensively in case a future API change emits them out of order.
  const groups = useMemo(() => {
    const ordered = [...citations].sort((markerA, markerB) => markerA.marker - markerB.marker);
    return groupCitationsByPage(ordered);
  }, [citations]);

  if (groups.length === 0) return null;

  const total = groups.length;
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
          {groups.map((group) => {
            const passages = group.count > 1 ? `, ${group.count} cited passages` : '';
            return (
              <li key={group.key} className={styles.item}>
                <button
                  type="button"
                  className={styles.source}
                  onClick={() => onOpen(group.representative)}
                  aria-label={`${group.fileName}, page ${group.page}${passages}`}
                >
                  <span className={styles.fileName} title={group.fileName}>
                    {group.fileName}
                  </span>
                  <span className={styles.page} aria-hidden="true">
                    p{group.page}
                  </span>
                  {group.count > 1 && (
                    <span className={styles.count} aria-hidden="true">
                      ({group.count})
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
