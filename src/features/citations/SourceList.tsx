/**
 * "View N sources" expander shown beneath each completed assistant message.
 *
 * Sources are derived from the message's `citations` array, grouped and
 * deduped by `fileName` via `groupCitationsBySource`. Each source row shows
 * the file name and the unique pages it's cited on. Clicking a row opens
 * the viewer at that source's first cited page (the same `onOpen` contract
 * that `<CitationMarker>` uses, with the citation it carries).
 *
 * Doc-type pills and section headings are deferred per REQUIREMENTS.md §10
 * (need a `GET /documents/{id}` round-trip not in v1's scope).
 */

import { useState } from 'react';
import { CaretDown, CaretRight } from '@phosphor-icons/react';

import type { Citation } from '@shared/types';
import { groupCitationsBySource } from '@shared/types';

import styles from './SourceList.module.scss';

interface Props {
  citations: ReadonlyArray<Citation>;
  onOpen: (citation: Citation) => void;
}

export const SourceList = ({ citations, onOpen }: Props) => {
  const [expanded, setExpanded] = useState(false);

  if (citations.length === 0) return null;

  const groups = groupCitationsBySource([...citations]);
  const total = groups.length;

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
        <span>{expanded ? 'Hide sources' : `View ${total} ${total === 1 ? 'source' : 'sources'}`}</span>
      </button>
      {expanded && (
        <ul className={styles.list} aria-label="Cited sources">
          {groups.map((group) => (
            <li key={group.fileName} className={styles.item}>
              <button
                type="button"
                className={styles.source}
                onClick={() => onOpen(group.firstCitation)}
              >
                <span className={styles.fileName}>{group.fileName}</span>
                <span className={styles.pages}>
                  {group.pages.length === 1
                    ? `Page ${group.pages[0]}`
                    : `Pages ${group.pages.join(', ')}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
