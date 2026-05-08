/**
 * SSE-streaming send-message hook. Manages the full lifecycle of a single
 * outgoing message:
 *
 *   1. Optimistically append the user bubble to history.
 *   2. POST `/document-sets/{id}/conversations/{convId}/messages` with
 *      `Accept: text/event-stream`.
 *   3. Iterate the SSE event stream:
 *      - `event: token` → append `text` to the assistant buffer.
 *      - `event: citation` → append to the citations array.
 *      - `event: error` → fail the stream with the message.
 *   4. On stream complete, commit the assistant bubble + invalidate the
 *      history query so the next render reflects server state.
 *   5. On abort, drop the in-flight assistant content silently.
 *
 * Pre-stream errors come back as ProblemDetails (400/401/403/404). The
 * fetch resolves with `!response.ok` and we emit a single error event.
 *
 * Per REQUIREMENTS.md §4.4.
 */

import { useCallback, useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import type {
  CitationData,
  LlmProvider,
  TokenChunkEvent,
} from '@shared/types';

import { useAccessToken } from '../../auth/useAccessToken';
import { config } from '../../config/env';

import { messageStreamPath } from './chatApi';
import { historyQueryKey } from './useChatHistory';
import { parseSse } from '../../utils/parseSse';

export interface StreamingMessage {
  /** Optimistic id (uuid) for the user bubble. */
  userMessageId: string;
  userText: string;
  assistantBuffer: string;
  citations: CitationData[];
  /** Set when the stream errors (pre-stream or mid-stream). */
  error: string | null;
  /** Set after the stream completes successfully. */
  completed: boolean;
}

export interface SendArgs {
  documentSetId: string;
  conversationId: string;
  content: string;
  llmProvider: LlmProvider;
}

export const useSseChat = () => {
  const getAccessToken = useAccessToken();
  const queryClient = useQueryClient();
  const [streaming, setStreaming] = useState<StreamingMessage | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setStreaming(null);
  }, []);

  const send = useCallback(
    async ({ documentSetId, conversationId, content, llmProvider }: SendArgs) => {
      // Tear down any prior stream — only one in-flight at a time per panel.
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      const userMessageId = crypto.randomUUID();
      setStreaming({
        userMessageId,
        userText: content,
        assistantBuffer: '',
        citations: [],
        error: null,
        completed: false,
      });

      try {
        const token = await getAccessToken();
        const response = await fetch(
          `${config.apiBaseUrl}${messageStreamPath(documentSetId, conversationId)}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              Accept: 'text/event-stream',
            },
            body: JSON.stringify({ content, llmProvider }),
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          let message = response.statusText;
          try {
            const body = (await response.json()) as { detail?: string };
            if (body?.detail) message = body.detail;
          } catch {
            /* no JSON body */
          }
          setStreaming((prev) =>
            prev ? { ...prev, error: message, completed: true } : prev,
          );
          return;
        }

        if (!response.body) {
          setStreaming((prev) =>
            prev ? { ...prev, error: 'No response body', completed: true } : prev,
          );
          return;
        }

        for await (const evt of parseSse(response.body, controller.signal)) {
          if (controller.signal.aborted) return;
          if (evt.event === 'token') {
            const payload = JSON.parse(evt.data) as TokenChunkEvent;
            setStreaming((prev) =>
              prev
                ? { ...prev, assistantBuffer: prev.assistantBuffer + payload.text }
                : prev,
            );
          } else if (evt.event === 'citation') {
            const payload = JSON.parse(evt.data) as CitationData;
            setStreaming((prev) =>
              prev ? { ...prev, citations: [...prev.citations, payload] } : prev,
            );
          } else if (evt.event === 'error') {
            const payload = JSON.parse(evt.data) as { message: string };
            setStreaming((prev) =>
              prev
                ? { ...prev, error: payload.message, completed: true }
                : prev,
            );
            return;
          }
        }

        // Stream ended cleanly.
        setStreaming((prev) => (prev ? { ...prev, completed: true } : prev));
        // Refresh server-side history so next render gets the persisted messages.
        queryClient.invalidateQueries({ queryKey: historyQueryKey(conversationId) });
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : String(err);
        setStreaming((prev) =>
          prev ? { ...prev, error: message, completed: true } : prev,
        );
      } finally {
        if (controllerRef.current === controller) {
          controllerRef.current = null;
        }
      }
    },
    [getAccessToken, queryClient],
  );

  return { streaming, send, abort, setStreaming };
};
