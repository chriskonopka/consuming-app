/**
 * Mirror of the GlobalIndexer API DTOs the consuming app consumes.
 *
 * Source of truth: ../../reusable-indexer/frontend-api-contract.md
 *
 * If the API contract changes, update this file FIRST (with the contract
 * version noted in a comment), then propagate consumers. Do not let consumers
 * drift toward inferred shapes.
 */

// =============================================================================
// Shared enums
// =============================================================================

export type AccessRole = 'Owner' | 'Shared';

export type LlmProvider = 'Claude' | 'OpenAi';

export type DocumentStatus = 'Pending' | 'Indexing' | 'Ready' | 'Failed';

export type FileTypeCode = 'Financial' | 'Contract' | 'Regulatory' | 'Other';

// =============================================================================
// Collections
// =============================================================================

export interface DocumentSetSummary {
  documentSetId: string;
  name: string;
  accessRole: AccessRole;
  updatedAt: string; // ISO 8601 UTC
}

export interface DocumentSetResponse {
  documentSetId: string;
  name: string;
  ownerUserId: string;
  accessRole: AccessRole;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// Conversations
// =============================================================================

export interface ConversationSummary {
  conversationId: string;
  title: string;
  messageCount: number;
  lastMessageAt: string | null;
}

export interface ConversationResponse {
  conversationId: string;
  documentSetId: string;
  userId: string;
  title: string;
  messageCount: number;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationHistoryResponse {
  conversationId: string;
  totalMessages: number;
  messages: MessageResponse[];
  etag: string;
}

export interface MessageResponse {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  llmProvider: LlmProvider | null;
  citations: CitationData[] | null;
}

export interface CitationData {
  marker: number;
  page: number; // 1-based
  x: number; // PDF points, origin top-left
  y: number;
  w: number;
  h: number;
  fileName: string;
}

// =============================================================================
// Documents
// =============================================================================

export interface DocumentMetadataResponse {
  documentId: string;
  documentSetId: string;
  batchId: string;
  folderId: string | null;
  fileName: string;
  fileType: FileTypeCode;
  contentType: string;
  fileSizeBytes: number;
  status: DocumentStatus;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// SSE chat
// =============================================================================

export interface SendMessageRequest {
  content: string; // capped at 64 KB by the server
  llmProvider?: LlmProvider; // defaults to 'Claude' on the server
}

/** SSE event payloads — discriminated by event channel name, not by a `type` field. */

export interface TokenChunkEvent {
  text: string;
}

/** Same shape as CitationData — emitted as `event: citation` over SSE. */
export type CitationEvent = CitationData;

export interface StreamErrorEvent {
  message: string;
}

// =============================================================================
// Pagination
// =============================================================================

export interface Paged<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface PagedRequest {
  page: number;
  pageSize: number;
}

// =============================================================================
// ProblemDetails (RFC 7807)
// =============================================================================

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  errors?: Record<string, string[]>;
}

/** Stable type slugs the consuming app may switch on. */
export type ProblemSlug =
  | 'validation-failed'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'llm-unavailable'
  | 'search-unavailable';
