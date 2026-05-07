# API Contracts

> The GlobalIndexer API contract is owned by the API project and documented in [`../../../reusable-indexer/frontend-api-contract.md`](../../../reusable-indexer/frontend-api-contract.md). This file does **not** restate it. Instead, it lists the endpoints the consuming app calls, what each is used for, and the host-contract surface the consuming app integrates against.

---

## 1. The Module Federation host contract (consumed)

The consuming app loads the indexer as a remote and integrates against `IndexerAppProps`, `IndexerEvent`, and `IndexerHandle`. Full type lives in [`../../../reusable-indexer/shared/types/host-contract.ts`](../../../reusable-indexer/shared/types/host-contract.ts).

### 1.1 Federation surface

```
remote: mws_indexer
url:    ${INDEXER_REMOTE_URL}/remoteEntry.js
exposes:
  - mws_indexer/IndexerApp  → React.ForwardRefExoticComponent<IndexerAppProps & RefAttributes<IndexerHandle>>
  - mws_indexer/types       → TypeScript-only re-export
shared singletons:
  - react              (singleton, eager: false)
  - react-dom          (singleton, eager: false)
  - react-dom/client   (singleton, eager: false)
```

Versions of `react`, `react-dom`, and `@module-federation/enhanced` must match the indexer's `package.json` exactly. Mismatch → runtime "shared singleton" error.

### 1.2 Props passed to `<IndexerApp />`

| Prop | Required | Source |
|---|---|---|
| `apiBaseUrl` | yes | `process.env.API_BASE_URL` |
| `getAccessToken` | yes | `auth/` module — same function the consuming app uses for its own fetches |
| `appInsights` | no | shared singleton from `appInsights.ts` |
| `themeOverrides` | no | omitted in v1 (deferred per REQUIREMENTS.md §10) |
| `initialTheme` | no | resolved from `localStorage.theme-preference` and `prefers-color-scheme` |
| `initialState` | no | parsed from URL on first mount: `{ documentSetId, folderId, documentId }` |
| `onEvent` | yes | dispatcher in `indexer-host/` that routes events to reducers |

### 1.3 Events emitted by the indexer (consumed by us)

| Event | Consumer module | Action |
|---|---|---|
| `auth/expired` | `auth/` + `indexer-host/` | Trigger MSAL silent refresh; on success increment `IndexerHostState.remountKey`. On failure, set `AuthState.status='expired'` and show login. |
| `collection/activated` | `indexer-host/` + `chat/` + `viewer/` | Update `IndexerHostState.activeCollection`. Chat re-scopes (resolves conversation, loads history). Viewer closes if open document doesn't belong to new collection. URL updated to `/c/{id}` (push-state). |
| `collection/list-changed` | (none) | No-op in v1. Wire the handler so future use isn't a re-architecture. |
| `document/selected` | `viewer/` | Open viewer at `documentId`, page 1, no highlight. |
| `error/unhandled` | `telemetry/` | `appInsights.trackException({ exception: new Error(messageForLogs), properties: { operationId } })`. |

### 1.4 Imperative ref API (driven by us)

| Method | Trigger | Notes |
|---|---|---|
| `selectCollection(id \| null)` | URL change to `/c/{id}` (browser back/forward, deep link) | Best-effort; no-op if collection not in user's set. |
| `revealDocument(id)` | Citation or source-list click in chat | Best-effort; no-op if doc not in active collection. |

---

## 2. GlobalIndexer API endpoints (consumed)

Base URL: `${API_BASE_URL}` (e.g. `https://globalapi-test-dcfad7eka5b0gkhk.z01.azurefd.net`).

All requests carry `Authorization: Bearer <token>` from `getAccessToken()`. All requests log the response `X-Operation-Id` header to App Insights.

### 2.1 Collections (read-only)

| Endpoint | Module | Purpose |
|---|---|---|
| `POST /document-sets/list` | `indexer-host/` (rare — indexer owns the sidebar) | Resolve display name when consuming app needs it outside indexer's UI (e.g. window title, telemetry) |
| `GET /document-sets/{id}` | `indexer-host/` | `accessRole`-only check on URL deep-link before mounting (defense in depth) |

### 2.2 Conversations

| Endpoint | Module | Purpose |
|---|---|---|
| `POST /document-sets/{id}/conversations/list` | `chat/` | On `collection/activated`, fetch `{page:1, pageSize:1}` to find the existing auto-managed conversation |
| `POST /document-sets/{id}/conversations` | `chat/` | Lazy-create on first send when none exists |
| `POST /document-sets/{id}/conversations/{convId}/history` | `chat/` | Load full message array on conversation resolution (omit `offset/limit` for full load) |
| `DELETE /document-sets/{id}/conversations/{convId}` | `chat/` | "Clear" button — soft-delete then reset local state |

### 2.3 Chat (SSE)

| Endpoint | Module | Purpose |
|---|---|---|
| `POST /document-sets/{id}/conversations/{convId}/messages` | `chat/` | Send a user message, receive token+citation+error events as SSE |

Implementation rules (binding):
- `fetch` + `ReadableStream` reader, never `EventSource` (no `POST` / custom headers / `Authorization` support).
- `Content-Type: application/json`, `Accept: text/event-stream`.
- Body: `{ content: string, llmProvider: 'Claude' | 'OpenAi' }`. `content` capped at 64 KB (server-enforced).
- `AbortController` cancels mid-stream cleanly — server treats abort as cancellation, not failure.
- Pre-stream errors: parse as ProblemDetails, render `detail` as user-visible message.
- `error` event mid-stream: render non-blocking notice, do not retry.

### 2.4 Documents

| Endpoint | Module | Purpose |
|---|---|---|
| `GET /documents/{id}` | `viewer/` | Resolve metadata (fileName, contentType, fileType, fileSizeBytes) when opening |
| `GET /documents/{id}/content` | `viewer/` | Stream original file. Pdf.js consumes via custom fetch loader with bearer header. Images consumed via blob-URL pattern (`<img>` can't carry headers). |

`GET /documents/{id}/content` supports `Range: bytes=...` (single-range only). pdf.js uses ranges automatically for large PDFs.

### 2.5 NOT consumed by the consuming app

The indexer owns these — the consuming app must never call them:

- `POST /document-sets`, `PATCH /document-sets/{id}`, `DELETE /document-sets/{id}` — collection lifecycle
- `POST /document-sets/{id}/shares*` — sharing
- `POST /document-sets/{id}/folders*` — folder lifecycle
- `POST /document-sets/{id}/contents` — folder browsing
- `POST /document-sets/{id}/batches*` — upload batching
- `POST /documents`, `PATCH /documents/{id}`, `DELETE /documents/{id}` — document lifecycle

If the consuming app finds itself wanting one of these, it's a sign the indexer's host contract is missing an event or a ref method — file an issue against the indexer rather than calling the endpoint directly.

---

## 3. Error envelope

All API errors return RFC 7807 ProblemDetails (`Content-Type: application/problem+json`):

```json
{
  "type": "https://problems.api/<slug>",
  "title": "...",
  "status": 400,
  "detail": "...",
  "errors": { "<field>": ["<message>"] }
}
```

Stable `type` slugs the consuming app may switch on (subset relevant to our calls):
- `validation-failed` — message body or query bad → render the `errors` map field-by-field
- `forbidden` — permission denied → toast and disable affected UI
- `not-found` — resource gone → close viewer / clear chat / reload list
- `conflict` — `share-already-exists` etc. — n/a for us; we don't share
- `llm-unavailable` — render "AI service unavailable, try again" — does NOT happen mid-stream
- `search-unavailable` — render notice in chat, allow retry

A 401 from any endpoint behaves the same as the indexer's `auth/expired` event: trigger MSAL refresh, retry once.

---

## 4. Conventions inherited from the API

- Every request and response carries `X-Operation-Id` — log on the client.
- Authenticated responses are `Cache-Control: private, no-store` — do not cache in service workers.
- SSE response adds `Cache-Control: no-cache, no-store` and `X-Accel-Buffering: no`.
- Pagination shape: `{ items, totalCount, page, pageSize }`. Default `pageSize: 20`, max 100. Consuming app uses pageSize 1 for "find existing conversation" lookups.
- Ownership violation returns 403, never 404. Consuming app never tries to disambiguate; both surface as a clear error.
