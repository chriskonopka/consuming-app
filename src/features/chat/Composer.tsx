/**
 * Chat composer — textarea + Send/Abort button. Enter sends, Shift+Enter
 * adds a newline (per REQUIREMENTS §4.3).
 */

import { useCallback, useRef, type KeyboardEvent } from 'react';

import styles from './Composer.module.css';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onAbort: () => void;
  /** True when a response is streaming. */
  isStreaming: boolean;
  /** True when send should be disabled (no text, no collection, etc.). */
  canSend: boolean;
  placeholder?: string;
}

export const Composer = ({
  value,
  onChange,
  onSend,
  onAbort,
  isStreaming,
  canSend,
  placeholder,
}: Props) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (canSend && !isStreaming) onSend();
      }
    },
    [canSend, isStreaming, onSend],
  );

  return (
    <form
      className={styles.composer}
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend && !isStreaming) onSend();
      }}
    >
      <textarea
        ref={textareaRef}
        className={styles.textarea}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? 'Ask a question…'}
        rows={2}
        aria-label="Message"
        disabled={isStreaming}
      />
      {isStreaming ? (
        <button
          type="button"
          className={styles.abort}
          onClick={onAbort}
          aria-label="Stop response"
        >
          Stop
        </button>
      ) : (
        <button
          type="submit"
          className={styles.send}
          disabled={!canSend}
          aria-label="Send message"
        >
          Send
        </button>
      )}
    </form>
  );
};
