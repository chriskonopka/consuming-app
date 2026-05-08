/**
 * Renders the conversation as message bubbles. The streaming assistant message
 * appears at the tail when `streaming` is non-null.
 *
 * Inline `[N]` citation markers (REQUIREMENTS.md §4.3 / §5.1) are rendered by
 * `<CitationMarker>` from `features/citations/`; the click handler comes from
 * `useCitationClick` (opens the viewer + calls `revealDocument` on the
 * indexer ref). A `<SourceList>` expander follows each completed assistant
 * message so the user can browse cited files independently of inline markers.
 */

import { useEffect, useRef } from 'react';

import type {
  CitationData,
  LocalMessage,
  StreamingState,
} from '@shared/types';

import { CitationMarker, SourceList, useCitationClick } from '../citations';

import styles from './MessageList.module.scss';

interface Props {
  messages: ReadonlyArray<LocalMessage>;
  streaming: StreamingState | null;
  emptyStateLabel: string;
}

const renderContentWithCitations = (
  content: string,
  citations: ReadonlyArray<CitationData>,
  onOpen: (citation: CitationData) => void,
) => {
  // Split on `[cite:N]` markers in the model output. Per REQUIREMENTS.md §4.3,
  // the API emits `[cite:N]` inline tokens that the UI renders as superscript
  // `[N]`. Marker numbers without a matching citation event (rare; can happen
  // if the stream errors after a marker but before the citation event) render
  // as a strike-through "Unverified" stub via a synthetic zero-rect citation.
  const parts = content.split(/\[cite:(\d+)\]/g);
  const elements: Array<JSX.Element | string> = [];
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (index % 2 === 0) {
      if (part) elements.push(part);
      continue;
    }
    const marker = Number(part);
    const citation =
      citations.find((entry) => entry.marker === marker) ??
      ({
        marker,
        page: 1,
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        fileName: '',
      } satisfies CitationData);
    elements.push(
      <CitationMarker
        key={`cite-${index}-${marker}`}
        citation={citation}
        onOpen={onOpen}
      />,
    );
  }
  return elements;
};

export const MessageList = ({ messages, streaming, emptyStateLabel }: Props) => {
  const tailRef = useRef<HTMLDivElement>(null);
  const onCitationClick = useCitationClick();

  useEffect(() => {
    tailRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, streaming?.assistantBuffer]);

  if (messages.length === 0 && !streaming) {
    return (
      <div className={styles.empty} role="status" aria-live="polite">
        <p>{emptyStateLabel}</p>
      </div>
    );
  }

  return (
    <ol className={styles.list} aria-label="Conversation">
      {messages.map((message) => (
        <li
          key={message.id}
          className={`${styles.message} ${message.role === 'user' ? styles.user : styles.assistant}`}
        >
          <div className={styles.bubble}>
            {message.role === 'assistant'
              ? renderContentWithCitations(message.content, message.citations, onCitationClick)
              : message.content}
          </div>
          {message.role === 'assistant' && message.citations.length > 0 && (
            <SourceList citations={message.citations} onOpen={onCitationClick} />
          )}
        </li>
      ))}
      {streaming && (
        <>
          <li className={`${styles.message} ${styles.user}`}>
            <div className={styles.bubble}>{streaming.userMessageId && /* optimistic placeholder */ null}</div>
          </li>
          <li className={`${styles.message} ${styles.assistant}`}>
            <div className={styles.bubble} aria-live="polite">
              {renderContentWithCitations(
                streaming.assistantBuffer,
                streaming.citations,
                onCitationClick,
              )}
            </div>
          </li>
        </>
      )}
      <div ref={tailRef} aria-hidden="true" />
    </ol>
  );
};
