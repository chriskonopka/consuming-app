/**
 * Chat panel — slides in from the left when `open` is true. Renders the
 * conversation history, the streaming bubble, the status row, the composer,
 * and the Clear button + confirm dialog.
 *
 * Reads the active collection from `useActiveCollection()`. When that's null
 * (no collection selected yet), the panel still opens but renders a hint
 * pointing the user at the indexer's collection list.
 *
 * v1 hardcodes `llmProvider: 'Claude'` inside `useSseChat`; this panel never
 * surfaces a model picker.
 */

import { Sparkle, X } from '@phosphor-icons/react';
import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { IconButton } from '../../components/IconButton';
import { Panel } from '../../components/Panel';
import { Splitter } from '../../components/Splitter';
import { useActiveCollection } from '../indexer-host';
import { useApiClient } from '../../hooks/useApiClient';
import { appInsights } from '../../appInsights';

import { ClearConfirmDialog } from './ClearConfirmDialog';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import { StatusRow } from './StatusRow';
import { chatQueryKeys } from './queryKeys';
import { useChatHistory } from './useChatHistory';
import { useChatSession } from './useChatSession';
import { useSseChat, type UseSseChatCallbacks } from './useSseChat';
import { useStatusRow } from './useStatusRow';

import styles from './ChatPanel.module.scss';

const PANEL_ID = 'chat-panel';
export const CHAT_PANEL_MIN_PX = 320;
export const CHAT_PANEL_MAX_PX = 720;

interface Props {
  open: boolean;
  widthPx: number;
  onClose: () => void;
  onResize?: (widthPx: number) => void;
}

const trackSharedCollectionChat = (documentSetId: string) => {
  if (!appInsights) return;
  try {
    appInsights.trackEvent({
      name: 'shared-collection-chat',
      properties: { documentSetId },
    });
  } catch {
    // swallow — telemetry is observational
  }
};

export const ChatPanel = ({ open, widthPx, onClose, onResize }: Props) => {
  const activeCollection = useActiveCollection();
  const documentSetId = activeCollection?.documentSetId ?? null;

  const session = useChatSession(documentSetId);
  const history = useChatHistory(documentSetId, session?.state.conversationId ?? null);

  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const sseCallbacks: UseSseChatCallbacks = {
    onPreStreamError: setErrorNotice,
    onStreamError: setErrorNotice,
    onContentTooLong: () =>
      setErrorNotice('Message too long — keep under 64,000 characters.'),
  };

  const sse = useSseChat(
    session
      ? { state: session.state, dispatch: session.dispatch, callbacks: sseCallbacks }
      : {
          // No active collection — return a no-op chat client so the hooks
          // contract stays stable. The composer is disabled in this branch.
          state: { documentSetId: '', conversationId: null, streaming: null, composerText: '' },
          dispatch: () => undefined,
          callbacks: sseCallbacks,
        },
  );

  const statusRow = useStatusRow(session?.state ?? null, session?.dispatch ?? null);

  const queryClient = useQueryClient();
  const api = useApiClient();
  const clearMutation = useMutation({
    mutationFn: async () => {
      if (!session || !session.state.conversationId || !documentSetId) return;
      await api.del<void>(
        `/document-sets/${documentSetId}/conversations/${session.state.conversationId}`,
      );
    },
    onSuccess: async () => {
      if (!session) return;
      session.dispatch({ type: 'CONVERSATION_CLEARED' });
      if (documentSetId) {
        await queryClient.invalidateQueries({
          queryKey: chatQueryKeys.conversation(documentSetId),
        });
      }
      setConfirmingClear(false);
    },
    onError: () => {
      setErrorNotice('Could not clear — try again.');
      setConfirmingClear(false);
    },
  });

  const handleSend = useCallback(() => {
    if (!session) return;
    setErrorNotice(null);
    if (activeCollection?.accessRole === 'Shared' && documentSetId) {
      trackSharedCollectionChat(documentSetId);
    }
    void sse.send(session.state.composerText);
  }, [session, sse, activeCollection, documentSetId]);

  const handleAbort = useCallback(() => sse.abort(), [sse]);

  const handleComposerChange = useCallback(
    (text: string) => {
      if (!session) return;
      session.dispatch({ type: 'COMPOSER_CHANGED', text });
    },
    [session],
  );

  const handleClearRequest = useCallback(() => setConfirmingClear(true), []);
  const handleClearCancel = useCallback(() => setConfirmingClear(false), []);
  const handleClearConfirm = useCallback(() => clearMutation.mutate(), [clearMutation]);

  const hasHistory = history.messages.length > 0 || session?.state.streaming != null;

  return (
    <Panel id={PANEL_ID} side="left" open={open} widthPx={widthPx} onClose={onClose} ariaLabel="Chat">
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <Sparkle size={20} weight="regular" aria-hidden="true" focusable="false" />
          <h2 className={styles.title}>Ask questions</h2>
        </div>
        <div className={styles.headerActions}>
          {hasHistory && session && (
            <button
              type="button"
              className={styles.clearButton}
              onClick={handleClearRequest}
              disabled={!session.state.conversationId || clearMutation.isPending}
            >
              Clear
            </button>
          )}
          <IconButton icon={X} ariaLabel="Close chat panel" onClick={onClose} />
        </div>
      </header>

      <div className={styles.body}>
        {!documentSetId ? (
          <div className={styles.empty} role="status" aria-live="polite">
            <p>Open a collection to start chatting.</p>
          </div>
        ) : history.error ? (
          <div className={styles.errorState} role="alert">
            <p>Could not load conversation history. Try switching collections and back.</p>
          </div>
        ) : session?.conversationError ? (
          <div className={styles.errorState} role="alert">
            <p>Could not connect to the chat service. Try again.</p>
          </div>
        ) : (
          <MessageList
            messages={history.messages}
            streaming={session?.state.streaming ?? null}
            emptyStateLabel="Ask anything about this collection"
          />
        )}
        <StatusRow state={statusRow} />
        {errorNotice && (
          <div className={styles.errorNotice} role="alert">
            {errorNotice}
          </div>
        )}
      </div>

      <Composer
        value={session?.state.composerText ?? ''}
        disabled={!documentSetId}
        isStreaming={sse.isStreaming}
        onChange={handleComposerChange}
        onSend={handleSend}
        onAbort={handleAbort}
      />

      <ClearConfirmDialog
        open={confirmingClear}
        pending={clearMutation.isPending}
        onConfirm={handleClearConfirm}
        onCancel={handleClearCancel}
      />

      {onResize && (
        <div className={styles.resizeEdge}>
          <Splitter
            direction="horizontal"
            resizeFrom="left"
            widthPx={widthPx}
            minPx={CHAT_PANEL_MIN_PX}
            maxPx={CHAT_PANEL_MAX_PX}
            onResize={onResize}
            ariaLabel="Resize chat panel"
          />
        </div>
      )}
    </Panel>
  );
};
