/**
 * SSE streaming chat client. Wraps `fetch` + `ReadableStream` reader (never
 * `EventSource`, which doesn't support POST / Authorization). v1 hardcodes
 * `llmProvider: 'Claude'` per REQUIREMENTS.md §4.9 / §10.
 *
 * Lifecycle:
 *   send() →
 *     ensure conversation (lazy-create if `state.conversationId` is null) →
 *     dispatch STREAM_STARTED with the AbortController →
 *     POST messages with `Accept: text/event-stream` →
 *       pre-stream error (ProblemDetails)? → callback `onPreStreamError(detail)` + STREAM_FAILED
 *       otherwise iterate `parseSse()`:
 *         - `token`   → STREAM_TOKEN (preserved arrival order)
 *         - `citation`→ STREAM_CITATION
 *         - `error`   → callback `onStreamError(message)` + STREAM_FAILED
 *     stream done → STREAM_ENDED → invalidate history query
 *
 * abort() forwards to the controller; the reducer treats it as STREAM_ABORTED
 * (no error surfaced — user-driven cancellation per spec §4.4).
 *
 * Telemetry: trackException is called on hard failures (network, parse error,
 * pre-stream problem). Token text and AI response content are NEVER logged
 * (`web-error-logging.md` + CLAUDE.md "PII discipline").
 */

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, type Dispatch } from 'react';

import {
  SEND_MESSAGE_SELECTION_MAX,
  V1_CHAT_LLM_PROVIDER,
  type ChatSession,
  type CitationData,
  type ConversationResponse,
  type SendMessageRequest,
  type StreamErrorEvent,
  type TokenChunkEvent,
} from '@shared/types';

import { appInsights } from '../../appInsights';
import { useApiClient, ApiError } from '../../hooks/useApiClient';
import { problemDetails } from '../../utils/problemDetails';
import { parseSse } from '../../utils/parseSse';

import { type ChatAction } from './chatReducer';
import { chatQueryKeys } from './queryKeys';

/** Server-enforced cap. Surface humanised message client-side per spec §4.3. */
export const CONTENT_MAX_BYTES = 64 * 1024;

export type SendErrorKind = 'pre-stream' | 'mid-stream';

export interface UseSseChatCallbacks {
  /**
   * Called once per send when the server returns a ProblemDetails before any
   * SSE events are emitted (validation / forbidden / not-found / etc.). The
   * `detail` is safe to render verbatim per api-contracts.md §3.
   */
  onPreStreamError: (detail: string) => void;
  /**
   * Called when an `error` event arrives mid-stream. Per spec §4.4 the UI
   * surfaces this as a non-blocking notice; the user message is NOT persisted
   * server-side and the input remains populated for retry — handled by the
   * caller because the composer text is reducer state.
   */
  onStreamError: (message: string) => void;
  /**
   * Called when the message length is over the content cap so the caller can
   * surface a humanised "too long" notice without dispatching anything.
   */
  onContentTooLong: () => void;
  /**
   * Called when documentIds/folderIds exceed the per-array cap (defense in
   * depth — the chat-scope reducer also caps adds). The server would respond
   * with 400 ValidationFailed; this avoids the round-trip.
   */
  onSelectionTooLarge: () => void;
}

export interface UseSseChatReturn {
  send: (text: string) => Promise<void>;
  abort: () => void;
  isStreaming: boolean;
}

interface UseSseChatArgs {
  state: ChatSession;
  dispatch: Dispatch<ChatAction>;
  callbacks: UseSseChatCallbacks;
  /**
   * Selection-scoped retrieval (added 2026-05-11 per SindhuraG-lab/GlobalAPI#1).
   * Empty arrays / undefined send no narrowing → whole DocumentSet retrieval.
   */
  selection?: {
    documentIds: string[];
    folderIds: string[];
  };
}

const utf8ByteLength = (input: string): number => new TextEncoder().encode(input).length;

const trackChatException = (error: unknown, properties?: Record<string, string>) => {
  if (!appInsights) return;
  try {
    appInsights.trackException({
      exception: error instanceof Error ? error : new Error(String(error)),
      properties,
    });
  } catch {
    // swallow telemetry failures — observational, never load-bearing
  }
};

const decodeJson = <T>(raw: string): T | null => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const useSseChat = ({
  state,
  dispatch,
  callbacks,
  selection,
}: UseSseChatArgs): UseSseChatReturn => {
  const api = useApiClient();
  const queryClient = useQueryClient();

  // Snapshot reducer state in a ref so the send() callback can read fresh
  // values without recreating itself on every state change. The reducer is
  // the single source of truth; we never *read* state.streaming here for
  // logic — only for closing references (e.g. checking conversationId).
  const stateRef = useRef(state);
  stateRef.current = state;

  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  // Selection is read at send time, not closed-over at hook-creation, so a
  // selection change made between renders is reflected in the next send.
  const selectionRef = useRef(selection);
  selectionRef.current = selection;

  const ensureConversation = useCallback(
    async (documentSetId: string): Promise<string> => {
      const existing = stateRef.current.conversationId;
      if (existing) return existing;
      const created = await api.post<ConversationResponse>(
        `/document-sets/${documentSetId}/conversations`,
        {},
      );
      dispatch({ type: 'CONVERSATION_RESOLVED', conversationId: created.conversationId });
      return created.conversationId;
    },
    [api, dispatch],
  );

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (trimmed.length === 0) return;
      if (utf8ByteLength(trimmed) > CONTENT_MAX_BYTES) {
        callbacksRef.current.onContentTooLong();
        return;
      }
      const currentSelection = selectionRef.current;
      if (
        currentSelection &&
        (currentSelection.documentIds.length > SEND_MESSAGE_SELECTION_MAX ||
          currentSelection.folderIds.length > SEND_MESSAGE_SELECTION_MAX)
      ) {
        callbacksRef.current.onSelectionTooLarge();
        return;
      }
      const documentSetId = stateRef.current.documentSetId;

      let conversationId: string;
      try {
        conversationId = await ensureConversation(documentSetId);
      } catch (error) {
        trackChatException(error, { stage: 'ensure-conversation' });
        const detail =
          error instanceof ApiError && error.problem?.detail
            ? error.problem.detail
            : 'Could not start a conversation. Try again.';
        callbacksRef.current.onPreStreamError(detail);
        return;
      }

      const userMessageId = crypto.randomUUID();
      const abortController = new AbortController();
      dispatch({
        type: 'STREAM_STARTED',
        userMessageId,
        userMessageText: trimmed,
        conversationId,
        abortController,
        now: Date.now(),
      });

      const body: SendMessageRequest = { content: trimmed, llmProvider: V1_CHAT_LLM_PROVIDER };
      if (currentSelection?.documentIds.length) {
        body.documentIds = currentSelection.documentIds;
      }
      if (currentSelection?.folderIds.length) {
        body.folderIds = currentSelection.folderIds;
      }

      let response: Response;
      try {
        response = await api.raw(
          `/document-sets/${documentSetId}/conversations/${conversationId}/messages`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'text/event-stream',
            },
            body: JSON.stringify(body),
            signal: abortController.signal,
          },
        );
      } catch (error) {
        if (abortController.signal.aborted) {
          dispatch({ type: 'STREAM_ABORTED' });
          return;
        }
        trackChatException(error, { stage: 'fetch' });
        callbacksRef.current.onPreStreamError('Network error — check your connection and retry.');
        dispatch({ type: 'STREAM_FAILED' });
        return;
      }

      if (!response.ok) {
        const problem = await problemDetails(response);
        const detail = problem?.detail ?? `Request failed (${response.status}). Try again.`;
        trackChatException(new Error('chat-pre-stream-error'), {
          stage: 'pre-stream',
          status: String(response.status),
          slug: problem?.type ?? 'unknown',
        });
        callbacksRef.current.onPreStreamError(detail);
        dispatch({ type: 'STREAM_FAILED' });
        return;
      }

      const stream = response.body;
      if (!stream) {
        trackChatException(new Error('chat-empty-stream'), { stage: 'pre-stream' });
        callbacksRef.current.onPreStreamError('No response received. Try again.');
        dispatch({ type: 'STREAM_FAILED' });
        return;
      }

      try {
        let endedByErrorEvent = false;
        for await (const event of parseSse(stream, abortController.signal)) {
          // Token frames: `frontend-api-contract.md` documents `event: token`
          // but the deployed API emits `event: text_chunk`. Accept both so we
          // work against the live API today and remain compatible if/when the
          // server is corrected to match the contract.
          if (event.event === 'token' || event.event === 'text_chunk') {
            const parsed = decodeJson<TokenChunkEvent>(event.data);
            if (parsed?.text) dispatch({ type: 'STREAM_TOKEN', text: parsed.text });
          } else if (event.event === 'citation') {
            const parsed = decodeJson<CitationData>(event.data);
            if (parsed) dispatch({ type: 'STREAM_CITATION', citation: parsed });
          } else if (event.event === 'error') {
            endedByErrorEvent = true;
            const parsed = decodeJson<StreamErrorEvent>(event.data);
            callbacksRef.current.onStreamError(
              parsed?.message ?? 'Stream interrupted — try again.',
            );
            dispatch({ type: 'STREAM_FAILED' });
            break;
          }
        }
        if (!endedByErrorEvent && !abortController.signal.aborted) {
          dispatch({ type: 'STREAM_ENDED' });
          await queryClient.invalidateQueries({
            queryKey: chatQueryKeys.history(documentSetId, conversationId),
          });
        }
      } catch (error) {
        if (abortController.signal.aborted) {
          dispatch({ type: 'STREAM_ABORTED' });
          return;
        }
        trackChatException(error, { stage: 'stream' });
        callbacksRef.current.onStreamError('Stream interrupted — try again.');
        dispatch({ type: 'STREAM_FAILED' });
      }
    },
    [api, dispatch, ensureConversation, queryClient],
  );

  const abort = useCallback(() => {
    stateRef.current.streaming?.abortController.abort();
  }, []);

  return {
    send,
    abort,
    isStreaming: state.streaming !== null,
  };
};
