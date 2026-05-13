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
  CompletedStreamSnapshot,
  LocalMessage,
  StreamingState,
} from '@shared/types';

import { CitationMarker, SourceList, useCitationClick } from '../citations';

import styles from './MessageList.module.scss';

interface Props {
  messages: ReadonlyArray<LocalMessage>;
  streaming: StreamingState | null;
  /**
   * Snapshot of the just-completed stream — rendered as tail bubbles when
   * /history hasn't caught up yet so the user keeps seeing their turn
   * after `STREAM_ENDED`. Hidden when `messages` already contains the same
   * user text (history caught up, server confirmed).
   */
  completed: CompletedStreamSnapshot | null;
  emptyStateLabel: string;
}

const historyContainsCompletedTurn = (
  messages: ReadonlyArray<LocalMessage>,
  completed: CompletedStreamSnapshot,
): boolean => {
  // Last persisted user message text matching the snapshot is the simplest
  // reliable signal — the server assigns its own message IDs so we can't
  // compare on id. Walk from the tail (the completed turn is the most
  // recent thing the user sent, so it lives at the end if present).
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== 'user') continue;
    return message.content === completed.userMessageText;
  }
  return false;
};

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
        documentId: null,
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

export const MessageList = ({
  messages,
  streaming,
  completed,
  emptyStateLabel,
}: Props) => {
  const tailRef = useRef<HTMLDivElement>(null);
  const onCitationClick = useCitationClick();

  const showCompleted =
    completed !== null &&
    !streaming &&
    !historyContainsCompletedTurn(messages, completed);

  useEffect(() => {
    tailRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, streaming?.assistantBuffer, showCompleted]);

  if (messages.length === 0 && !streaming && !showCompleted) {
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
            {/*
              Optimistic user-message bubble. Renders the trimmed text the
              user just sent so it stays visible during streaming — without
              this the bubble was empty until STREAM_ENDED triggered a
              history re-fetch with the persisted message.
            */}
            <div className={styles.bubble}>{streaming.userMessageText}</div>
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
      {showCompleted && completed && (
        <>
          <li className={`${styles.message} ${styles.user}`}>
            <div className={styles.bubble}>{completed.userMessageText}</div>
          </li>
          <li className={`${styles.message} ${styles.assistant}`}>
            <div className={styles.bubble}>
              {renderContentWithCitations(
                completed.assistantBuffer,
                completed.citations,
                onCitationClick,
              )}
            </div>
            {completed.citations.length > 0 && (
              <SourceList citations={completed.citations} onOpen={onCitationClick} />
            )}
          </li>
        </>
      )}
      <div ref={tailRef} aria-hidden="true" />
    </ol>
  );
};
