# Data Model

> **Scope reminder:** the consuming app is a frontend host. Authoritative entities (DocumentSet, Document, Folder, Conversation, Message, Citation) live in the GlobalIndexer API and SQL/Blob — see [`../../../reusable-indexer/frontend-api-contract.md`](../../../reusable-indexer/frontend-api-contract.md). This file describes the **client-side** model: what the consuming app holds in memory, where it sources each value, and how long it lives.

---

## 1. Entities sourced from the API (read-only mirrors)

| Entity | Source endpoint | Cache strategy | Owner module |
|---|---|---|---|
| `DocumentSetSummary` | `POST /document-sets/list`, indexer event `collection/list-changed` | TanStack Query, `staleTime: 30s` | Indexer (we observe via events) |
| `DocumentSetDetail` | `GET /document-sets/{id}` | TanStack Query, `staleTime: 30s` | indexer-host |
| `DocumentMetadata` | `GET /documents/{id}` | TanStack Query, `staleTime: 5min` (immutable post-upload except `fileType`) | viewer |
| `ConversationSummary` | `POST /document-sets/{id}/conversations/list` | TanStack Query, `staleTime: 0` (re-fetch on mount) | chat |
| `ConversationHistory` | `POST /document-sets/{id}/conversations/{convId}/history` | TanStack Query, manually invalidated after each assistant response | chat |
| `Citation` | inline on `MessageResponse.citations[]` and SSE `citation` events | embedded in chat state | chat / citations / viewer |

DTOs are typed in [`/shared/types/api-dtos.ts`](../../shared/types/api-dtos.ts) and mirror the API contract verbatim. The consuming app does **not** persist these to IndexedDB — they are server-authoritative.

---

## 2. Client-only state (consuming-app-owned)

### 2.1 `AuthState` — owner: `auth/`

```ts
type AuthState =
  | { status: 'unauthenticated' }
  | { status: 'authenticating' }
  | { status: 'authenticated'; account: AccountInfo }
  | { status: 'expired' };           // from indexer's auth/expired event
```

- Source: MSAL `PublicClientApplication` events + indexer `auth/expired` event.
- Persistence: MSAL handles its own (sessionStorage). We do not mirror.
- Lifecycle: app boot → mount.

### 2.2 `IndexerHostState` — owner: `indexer-host/`

```ts
interface IndexerHostState {
  activeCollection: { documentSetId: string; accessRole: AccessRole } | null;
  initialState: { documentSetId?: string; folderId?: string; documentId?: string };
  remountKey: number;  // incremented on auth/expired recovery to force remount
}
```

- Source: indexer events (`collection/activated`) + URL parsing on first mount.
- Persistence: none directly. The indexer manages its own last-active persistence under the `mws-indexer:` namespace.
- Lifecycle: app boot → unmount.

### 2.3 `ChatSession` — owner: `chat/`

```ts
interface ChatSession {
  documentSetId: string;
  conversationId: string | null;        // null until first send creates one
  modelPicker: 'Balanced' | 'Powerful'; // maps to llmProvider in §4.9 of REQUIREMENTS.md
  streaming: StreamingState | null;
  composerText: string;
}

type StreamingState = {
  userMessageId: string;            // crypto.randomUUID() — used to render the optimistic user bubble
  assistantBuffer: string;           // accumulated tokens in arrival order
  citations: Citation[];             // accumulated citation events
  abortController: AbortController;
  phase: SimulatedPhase;             // 'reading-collection' | ... | 'finalizing'
  phaseStartedAt: number;            // ms epoch — drives fallback cycle
};
```

- One `ChatSession` per `(activeCollection)` — instantiated on `collection/activated`.
- `conversationId` resolved from `POST /conversations/list` page 1, lazy-created on first send.
- `streaming` is non-null only while a response is in flight.
- Persistence: `composerText` not persisted (transient). `modelPicker` not persisted across sessions in v1 (per REQUIREMENTS.md §10).

### 2.4 `ViewerState` — owner: `viewer/`

```ts
interface ViewerState {
  open: { documentId: string; page: number; highlight: CitationRect | null } | null;
  pdfDocument: PDFDocumentProxy | null;  // from pdfjs-dist
  pageRenderState: 'loading' | 'rendering' | 'rendered' | 'error';
  driftGuardFired: boolean;              // true → render "Couldn't locate" banner
  totalPages: number;
}

interface CitationRect {
  page: number;
  x: number;  // PDF points, origin top-left
  y: number;
  w: number;
  h: number;
  fileName: string;
  marker: number;
}
```

- Source: clicks in chat (citation, source list) or indexer `document/selected` event.
- Persistence: none (closing the viewer drops state; reopening re-fetches).

### 2.5 `LayoutState` — owner: `app-shell/`

```ts
interface LayoutState {
  chatPanel: { open: boolean; widthPx: number };
  viewerPanel: { open: boolean; widthPx: number };
  theme: 'light' | 'dark';
}
```

- `chatPanel.widthPx`, `viewerPanel.widthPx`, `chatPanel.open` → IndexedDB via `usePersistedReducer` (per `web-persistence.md`).
- `theme` → `localStorage.theme-preference` (the only sanctioned localStorage key).
- `viewerPanel.open` → not persisted (transient on each session).

### 2.6 `TelemetryContext` — owner: `telemetry/`

Carries `operationId` for correlation across API calls. Read from response `X-Operation-Id` header on each fetch and logged with the request via `appInsights.trackDependency`. No state machine — purely observational.

---

## 3. Persistence keys

| Key | Storage | Owner | Lifetime |
|---|---|---|---|
| `theme-preference` | localStorage | app-shell | persistent |
| `consuming-app:chat-panel-width` | IndexedDB (object store: `app-state`) | app-shell | persistent |
| `consuming-app:viewer-panel-width` | IndexedDB | app-shell | persistent |
| `consuming-app:chat-panel-open` | IndexedDB | app-shell | persistent |
| MSAL token cache | sessionStorage (MSAL-managed) | auth | session |
| `mws-indexer:*` | IndexedDB / localStorage | indexer (off-limits to consuming app) | indexer-managed |

The consuming app **never** writes to keys outside `consuming-app:*` and `theme-preference`.

---

## 4. State invariants

1. `ChatSession.conversationId === null ⟹ no streaming, no history loaded`. The composer is still usable.
2. `streaming !== null ⟹ send button disabled, abort button visible, status row visible`.
3. `IndexerHostState.activeCollection?.accessRole === 'Shared' ⟹ chat panel still works (read-only viewers can chat per §4.6 of REQUIREMENTS.md), but no upload/mutate UI exists in indexer or consuming app`.
4. `ViewerState.open !== null ⟹ pdfDocument loaded or loading; never null while a doc is supposedly open`.
5. `AuthState.status === 'expired' ⟹ indexer remount pending; new API calls are queued or rejected client-side`.

These invariants are enforced by reducer logic, not runtime asserts.
