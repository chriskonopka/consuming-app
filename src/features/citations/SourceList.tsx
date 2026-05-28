/**
 * Source list shown beneath each completed assistant message.
 *
 * One entry per cited document: every line-level citation in a document is
 * grouped under a single header that shows the file name once plus a passage
 * count. Expanding a document reveals its individual passages as [N] links, each
 * opening the viewer at that citation's exact line. A heavily-cited document (a
 * scanned form cited on 20 lines) reads as one entry that opens up to its lines,
 * not as 20 near-identical rows.
 *
 * The inline [N] badges in the answer text stay 1:1 with citations; this panel
 * is the grouped index of where the answer drew from. Document identity is keyed
 * by documentId, never fileName (display-only — it can collide across
 * DocumentSets and be renamed); see `groupCitationsByDocument`.
 */

import { useId, useMemo, useState } from 'react';
import { CaretDown, CaretRight } from '@phosphor-icons/react';

import type { Citation } from '@shared/types';
import { groupCitationsByDocument } from '@shared/types';

import styles from './SourceList.module.scss';

interface Props {
  citations: ReadonlyArray<Citation>;
  onOpen: (citation: Citation) => void;
}

export const SourceList = ({ citations, onOpen }: Props) => {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [openDocKeys, setOpenDocKeys] = useState<ReadonlySet<string>>(() => new Set());
  const baseId = useId();

  // Sort by marker first so documents — and the passages within them — read in
  // the order they are first cited in the answer text, then group by document.
  // The server emits markers sequentially per response, so the sort is normally
  // a no-op; sort defensively in case a future API change emits them out of order.
  const groups = useMemo(() => {
    const ordered = [...citations].sort((markerA, markerB) => markerA.marker - markerB.marker);
    return groupCitationsByDocument(ordered);
  }, [citations]);

  if (groups.length === 0) return null;

  const total = groups.length;
  const label = `${total} ${total === 1 ? 'source' : 'sources'}`;

  const toggleDoc = (key: string) =>
    setOpenDocKeys((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={isPanelOpen}
        onClick={() => setIsPanelOpen((value) => !value)}
      >
        {isPanelOpen ? (
          <CaretDown size={16} weight="regular" aria-hidden="true" focusable="false" />
        ) : (
          <CaretRight size={16} weight="regular" aria-hidden="true" focusable="false" />
        )}
        <span>{isPanelOpen ? 'Hide sources' : `View ${label}`}</span>
      </button>
      {isPanelOpen && (
        <ul className={styles.list} aria-label="Cited sources">
          {groups.map((group, groupIndex) => {
            const isDocOpen = openDocKeys.has(group.key);
            const passagesId = `${baseId}-${groupIndex}`;
            const passageCount = group.citations.length;
            const passageLabel = `${passageCount} ${passageCount === 1 ? 'passage' : 'passages'}`;
            return (
              <li key={group.key} className={styles.item}>
                <button
                  type="button"
                  className={styles.source}
                  aria-expanded={isDocOpen}
                  aria-controls={isDocOpen ? passagesId : undefined}
                  aria-label={`${group.fileName}, ${passageLabel}`}
                  onClick={() => toggleDoc(group.key)}
                >
                  {isDocOpen ? (
                    <CaretDown size={14} weight="regular" aria-hidden="true" focusable="false" />
                  ) : (
                    <CaretRight size={14} weight="regular" aria-hidden="true" focusable="false" />
                  )}
                  <span className={styles.fileName} title={group.fileName}>
                    {group.fileName}
                  </span>
                  <span className={styles.count} aria-hidden="true">
                    ({passageCount})
                  </span>
                </button>
                {isDocOpen && (
                  <ul
                    className={styles.passageList}
                    id={passagesId}
                    aria-label={`Passages in ${group.fileName}`}
                  >
                    {group.citations.map((citation) => (
                      <li key={citation.marker} className={styles.passageItem}>
                        <button
                          type="button"
                          className={styles.passage}
                          onClick={() => onOpen(citation)}
                          aria-label={`Open citation ${citation.marker} on page ${citation.page}`}
                        >
                          <span className={styles.marker} aria-hidden="true">
                            [{citation.marker}]
                          </span>
                          <span className={styles.page} aria-hidden="true">
                            p{citation.page}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
