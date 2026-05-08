/**
 * Chat session and streaming types — owned by features/chat.
 *
 * v1 sends `llmProvider: 'Claude'` on every chat message (REQUIREMENTS.md §4.9).
 * The API's Claude path resolves to Claude Opus 4.7 server-side. The model
 * picker UI is deferred (REQUIREMENTS.md §10) — no `ModelPickerOption` type
 * needed until that comes back into scope.
 */

import type { CitationData, LlmProvider, MessageResponse } from './api-dtos';

/**
 * The single hardcoded provider sent on every `POST .../messages` body in v1.
 * Imported by `useSseChat()` so the constant lives in one place; replace with
 * a runtime selection when the model picker comes back into scope.
 */
export const V1_CHAT_LLM_PROVIDER: LlmProvider = 'Claude';

// =============================================================================
// Status row simulator
// =============================================================================

/** Phases shown in the status row above a streaming response. */
export type SimulatedPhase =
  | 'reading-collection'
  | 'picking-documents'
  | 'reading-files'
  | 'thinking'
  | 'finalizing';

// =============================================================================
// Streaming state
// =============================================================================

export interface StreamingState {
  /** Optimistic ID for the user-side bubble — `crypto.randomUUID()`. */
  userMessageId: string;
  /** Tokens accumulated in arrival order. */
  assistantBuffer: string;
  /** Citation events accumulated in arrival order. */
  citations: CitationData[];
  /** Cancels the SSE fetch on user abort or cleanup. */
  abortController: AbortController;
  /** Current simulated phase (client-side only — API doesn't emit phases). */
  phase: SimulatedPhase;
  /** ms epoch when phase started — drives fallback cycle. */
  phaseStartedAt: number;
}

// =============================================================================
// Chat session
// =============================================================================

export interface ChatSession {
  documentSetId: string;
  /** Null until first send creates a conversation. */
  conversationId: string | null;
  /** Non-null only while a response is in flight. */
  streaming: StreamingState | null;
  /** Composer textarea value — not persisted. */
  composerText: string;
}

// =============================================================================
// Local message representation
// =============================================================================

/**
 * Local representation of a message — superset of MessageResponse with
 * client-only fields (e.g. optimistic IDs before the server assigns one,
 * pending state during send, error state after stream interruption).
 */
export interface LocalMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  llmProvider: LlmProvider | null;
  citations: CitationData[];
  /** 'pending' = optimistic, 'committed' = confirmed by server, 'error' = stream failed. */
  status: 'pending' | 'committed' | 'error';
}

/** Convert a server MessageResponse into a LocalMessage (always 'committed'). */
export const toLocalMessage = (m: MessageResponse): LocalMessage => ({
  id: m.id,
  role: m.role,
  content: m.content,
  timestamp: m.timestamp,
  llmProvider: m.llmProvider,
  citations: m.citations ?? [],
  status: 'committed',
});
