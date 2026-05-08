/**
 * Slide-in chat panel: composer, message list, status row, model picker, and
 * Clear button. Wires the SSE streaming client (useSseChat), conversation
 * lifecycle (useConversation), and history (useChatHistory).
 *
 * Per REQUIREMENTS.md §4. Citation markers are rendered as plain `[N]`
 * text in slice 3 — slice 4 replaces with clickable buttons + viewer.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  type LocalMessage,
  type ModelPickerOption,
  MODEL_PICKER_TO_PROVIDER,
  toLocalMessage,
} from '@shared/types';

import { useActiveCollection } from '../indexer-host';

import { ClearConfirmDialog } from './ClearConfirmDialog';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import { ModelPicker } from './ModelPicker';
import { StatusRow } from './StatusRow';
import {
  useCreateConversation,
  useCurrentConversation,
  useDeleteConversation,
} from './useConversation';
import { useChatHistory } from './useChatHistory';
import { useSseChat } from './useSseChat';
import styles from './ChatPanel.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

export const ChatPanel = ({ open, onClose }: Props) => {
  const activeCollection = useActiveCollection();
  const documentSetId = activeCollection?.documentSetId ?? null;

  const [composerText, setComposerText] = useState('');
  const [modelPicker, setModelPicker] = useState<ModelPickerOption>('Balanced');
  const [clearOpen, setClearOpen] = useState(false);

  const conversationQuery = useCurrentConversation(documentSetId);
  const conversationId = conversationQuery.data?.conversationId ?? null;

  const historyQuery = useChatHistory(documentSetId, conversationId);
  const createConversation = useCreateConversation();
  const deleteConversation = useDeleteConversation();

  const { streaming, send, abort, setStreaming } = useSseChat();

  // Reset composer + streaming on collection switch.
  useEffect(() => {
    setComposerText('');
    setStreaming(null);
  }, [documentSetId, setStreaming]);

  const isStreaming = streaming !== null && !streaming.completed;

  const messages = useMemo<LocalMessage[]>(() => {
    const serverMessages = (historyQuery.data?.messages ?? []).map(toLocalMessage);
    if (!streaming) return serverMessages;
    const optimisticUser: LocalMessage = {
      id: streaming.userMessageId,
      role: 'user',
      content: streaming.userText,
      timestamp: new Date().toISOString(),
      llmProvider: null,
      citations: [],
      status: streaming.completed ? 'committed' : 'pending',
    };
    let assistantStream: LocalMessage | null = null;
    if (streaming.assistantBuffer) {
      assistantStream = {
        id: `${streaming.userMessageId}-assistant`,
        role: 'assistant',
        content: streaming.assistantBuffer,
        timestamp: new Date().toISOString(),
        llmProvider: MODEL_PICKER_TO_PROVIDER[modelPicker],
        citations: streaming.citations,
        status: streaming.error
          ? 'error'
          : streaming.completed
            ? 'committed'
            : 'pending',
      };
    } else if (streaming.error) {
      assistantStream = {
        id: `${streaming.userMessageId}-error`,
        role: 'assistant',
        content: streaming.error,
        timestamp: new Date().toISOString(),
        llmProvider: MODEL_PICKER_TO_PROVIDER[modelPicker],
        citations: [],
        status: 'error',
      };
    }
    const next = [...serverMessages, optimisticUser];
    if (assistantStream) next.push(assistantStream);
    return next;
  }, [historyQuery.data, streaming, modelPicker]);

  const handleSend = useCallback(async () => {
    if (!documentSetId) return;
    const content = composerText.trim();
    if (!content) return;
    setComposerText('');

    let resolvedConversationId = conversationId;
    if (!resolvedConversationId) {
      try {
        const created = await createConversation.mutateAsync({
          documentSetId,
          title: content.slice(0, 60),
        });
        resolvedConversationId = created.conversationId;
      } catch {
        return;
      }
    }

    void send({
      documentSetId,
      conversationId: resolvedConversationId,
      content,
      llmProvider: MODEL_PICKER_TO_PROVIDER[modelPicker],
    });
  }, [composerText, conversationId, createConversation, documentSetId, modelPicker, send]);

  const handleClearConfirm = useCallback(async () => {
    setClearOpen(false);
    if (!conversationId || !documentSetId) return;
    await deleteConversation.mutateAsync({ conversationId, documentSetId });
    setStreaming(null);
  }, [conversationId, deleteConversation, documentSetId, setStreaming]);

  if (!open) return null;

  if (!documentSetId) {
    return (
      <aside className={styles.panel} aria-label="Chat">
        <header className={styles.header}>
          <h2 className={styles.title}>Chat</h2>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close chat"
          >
            ✕
          </button>
        </header>
        <div className={styles.emptyState}>
          <p>Pick a collection from the sidebar to start a conversation.</p>
        </div>
      </aside>
    );
  }

  const showStatusRow =
    isStreaming &&
    streaming !== null &&
    streaming.assistantBuffer === '' &&
    !streaming.error;

  return (
    <aside className={styles.panel} aria-label="Chat">
      <header className={styles.header}>
        <h2 className={styles.title}>Chat</h2>
        <div className={styles.controls}>
          <ModelPicker
            value={modelPicker}
            onChange={setModelPicker}
            disabled={isStreaming}
          />
          <button
            type="button"
            className={styles.clearButton}
            onClick={() => setClearOpen(true)}
            disabled={!conversationId || isStreaming}
            aria-label="Clear conversation"
          >
            Clear
          </button>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close chat"
          >
            ✕
          </button>
        </div>
      </header>
      <MessageList messages={messages} isStreaming={isStreaming} />
      <div className={styles.statusRowSlot}>
        <StatusRow active={showStatusRow} />
      </div>
      <Composer
        value={composerText}
        onChange={setComposerText}
        onSend={handleSend}
        onAbort={abort}
        isStreaming={isStreaming}
        canSend={composerText.trim().length > 0 && !createConversation.isPending}
        placeholder={
          conversationId
            ? 'Ask a follow-up…'
            : 'Ask a question to start the conversation…'
        }
      />
      <ClearConfirmDialog
        open={clearOpen}
        onCancel={() => setClearOpen(false)}
        onConfirm={handleClearConfirm}
      />
    </aside>
  );
};
