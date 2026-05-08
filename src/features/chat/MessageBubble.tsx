/**
 * Single chat message — user or assistant. Citation markers are rendered as
 * superscripts in slice 4. For now `[cite:N]` renders as plain `[N]` text.
 */

import type { LocalMessage } from '@shared/types';

import styles from './MessageBubble.module.css';

interface Props {
  message: LocalMessage;
}

const renderContent = (content: string): string => {
  // Slice 3: strip the cite marker syntax and render N inline. Slice 4
  // replaces this with clickable <button> citation markers.
  return content.replace(/\[cite:(\d+)\]/g, '[$1]');
};

export const MessageBubble = ({ message }: Props) => {
  const isUser = message.role === 'user';
  return (
    <div
      className={`${styles.bubble} ${isUser ? styles.user : styles.assistant}`}
      data-status={message.status}
    >
      <span className={styles.role}>{isUser ? 'You' : 'Assistant'}</span>
      <p className={styles.content}>{renderContent(message.content)}</p>
      {message.status === 'error' && (
        <p className={styles.error}>Stream interrupted. Try again.</p>
      )}
    </div>
  );
};
