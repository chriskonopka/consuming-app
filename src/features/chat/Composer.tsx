/**
 * Multi-line composer for the chat panel.
 *
 * - Enter sends; Shift+Enter inserts a newline (REQUIREMENTS.md §4.3).
 * - Send button is disabled while streaming or when the input is empty.
 * - While streaming, an "Abort" button replaces "Send" (spec §4.4) — same
 *   visual position so muscle memory isn't broken.
 * - After send, focus returns to the textarea.
 * - Autosize: textarea grows up to a maximum height, then scrolls.
 */

import { PaperPlaneRight, X } from '@phosphor-icons/react';
import { useEffect, useRef, useCallback, type ChangeEvent, type KeyboardEvent } from 'react';

import { IconButton } from '../../components/IconButton';

import styles from './Composer.module.scss';

interface Props {
  value: string;
  disabled: boolean;
  isStreaming: boolean;
  onChange: (text: string) => void;
  onSend: () => void;
  onAbort: () => void;
}

const MAX_TEXTAREA_HEIGHT_PX = 240;

export const Composer = ({ value, disabled, isStreaming, onChange, onSend, onAbort }: Props) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autosize = useCallback(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = 'auto';
    const next = Math.min(node.scrollHeight, MAX_TEXTAREA_HEIGHT_PX);
    node.style.height = `${next}px`;
  }, []);

  useEffect(() => {
    autosize();
  }, [value, autosize]);

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (!disabled && value.trim().length > 0) {
        onSend();
      }
    }
  };

  const sendDisabled = disabled || isStreaming || value.trim().length === 0;

  return (
    <div className={styles.composer}>
      <textarea
        ref={textareaRef}
        className={styles.textarea}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={1}
        placeholder="Ask a question about this collection"
        aria-label="Message"
      />
      {isStreaming ? (
        <IconButton
          icon={X}
          ariaLabel="Stop generating"
          onClick={onAbort}
          tone="danger"
        />
      ) : (
        <IconButton
          icon={PaperPlaneRight}
          ariaLabel="Send message"
          onClick={onSend}
          disabled={sendDisabled}
          tone="primary"
        />
      )}
    </div>
  );
};
