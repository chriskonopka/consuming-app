/**
 * Chat session reducer — owns conversation id, streaming buffer, composer text.
 *
 * The reducer is pure: it never starts fetches, never advances time, never
 * touches storage. The owning hook (`useChatSession`) wires effects.
 *
 * Streaming state lives here (not in TanStack Query) because:
 *   - The buffer mutates per token at sub-frame intervals.
 *   - Cancellation needs synchronous access to the AbortController.
 *   - The composer / send button enable/disable state is derived from it.
 */

import type {
  ChatSession,
  CitationData,
  SimulatedPhase,
  StreamingState,
} from '@shared/types';

export type ChatAction =
  | { type: 'SET_DOCUMENT_SET'; documentSetId: string }
  | { type: 'CONVERSATION_RESOLVED'; conversationId: string | null }
  | { type: 'COMPOSER_CHANGED'; text: string }
  | {
      type: 'STREAM_STARTED';
      userMessageId: string;
      userMessageText: string;
      conversationId: string;
      abortController: AbortController;
      now: number;
    }
  | { type: 'STREAM_TOKEN'; text: string }
  | { type: 'STREAM_CITATION'; citation: CitationData }
  | { type: 'STREAM_PHASE'; phase: SimulatedPhase; now: number }
  | { type: 'STREAM_ENDED' }
  | { type: 'STREAM_FAILED' }
  | { type: 'STREAM_ABORTED' }
  | { type: 'CONVERSATION_CLEARED' };

export const buildInitialChatSession = (documentSetId: string): ChatSession => ({
  documentSetId,
  conversationId: null,
  streaming: null,
  completed: null,
  composerText: '',
});

const updateStreaming = (
  state: ChatSession,
  patch: Partial<StreamingState>,
): ChatSession => {
  if (!state.streaming) return state;
  return { ...state, streaming: { ...state.streaming, ...patch } };
};

export const chatReducer = (state: ChatSession, action: ChatAction): ChatSession => {
  switch (action.type) {
    case 'SET_DOCUMENT_SET':
      if (state.documentSetId === action.documentSetId) return state;
      // Cancel any in-flight stream when switching collections.
      state.streaming?.abortController.abort();
      return buildInitialChatSession(action.documentSetId);
    case 'CONVERSATION_RESOLVED':
      if (state.conversationId === action.conversationId) return state;
      return { ...state, conversationId: action.conversationId };
    case 'COMPOSER_CHANGED':
      return { ...state, composerText: action.text };
    case 'STREAM_STARTED':
      return {
        ...state,
        conversationId: action.conversationId,
        composerText: '',
        // Clear the previous completed snapshot — the new turn replaces it
        // as the "most recent thing the user said." Without this, two
        // pending turns can stack visually.
        completed: null,
        streaming: {
          userMessageId: action.userMessageId,
          userMessageText: action.userMessageText,
          assistantBuffer: '',
          citations: [],
          abortController: action.abortController,
          phase: 'reading-collection',
          phaseStartedAt: action.now,
        },
      };
    case 'STREAM_TOKEN':
      if (!state.streaming) return state;
      return updateStreaming(state, {
        assistantBuffer: state.streaming.assistantBuffer + action.text,
      });
    case 'STREAM_CITATION':
      if (!state.streaming) return state;
      return updateStreaming(state, {
        citations: [...state.streaming.citations, action.citation],
      });
    case 'STREAM_PHASE':
      if (!state.streaming) return state;
      if (state.streaming.phase === action.phase) return state;
      return updateStreaming(state, { phase: action.phase, phaseStartedAt: action.now });
    case 'STREAM_ENDED': {
      // Move the just-streamed user+assistant bubbles into `completed` so
      // they stay visible while /history catches up — see
      // `CompletedStreamSnapshot` doc comment.
      if (!state.streaming) return state;
      return {
        ...state,
        streaming: null,
        completed: {
          userMessageId: state.streaming.userMessageId,
          userMessageText: state.streaming.userMessageText,
          assistantBuffer: state.streaming.assistantBuffer,
          citations: state.streaming.citations,
          completedAt: Date.now(),
        },
      };
    }
    case 'STREAM_FAILED':
    case 'STREAM_ABORTED':
      if (!state.streaming) return state;
      return { ...state, streaming: null };
    case 'CONVERSATION_CLEARED':
      state.streaming?.abortController.abort();
      return { ...buildInitialChatSession(state.documentSetId) };
  }
};
