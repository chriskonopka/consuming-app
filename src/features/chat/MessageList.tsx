/**
 * Scrollable conversation transcript. Auto-scrolls to bottom on new content.
 */

import { useEffect, useRef } from 'react';

import type { LocalMessage } from '@shared/types';

import { MessageBubble } from './MessageBubble';
import styles from './MessageList.module.css';

interface Props {
  messages: LocalMessage[];
  /** True when assistant tokens are still arriving — affects auto-scroll behavior. */
  isStreaming: boolean;
}

export const MessageList = ({ messages, isStreaming }: Props) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: isStreaming ? 'auto' : 'smooth' });
  }, [messages, isStreaming]);

  if (messages.length === 0) {
    return (
      <div className={styles.empty}>
        <p>Ask a question about this collection. The assistant grounds its answer in your documents.</p>
      </div>
    );
  }

  return (
    <div className={styles.list} role="log" aria-label="Chat conversation" aria-live="polite">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
};
