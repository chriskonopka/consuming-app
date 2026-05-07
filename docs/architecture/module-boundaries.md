# Module Boundaries

Locks what each module owns, what it exposes, and what it must not do. Every later step (scaffold, build) assumes these boundaries.

---

## 1. Top-level layout

```
src/
├── main.tsx              # Synchronous entry — defers via async import
├── bootstrap.tsx         # MF async boundary — actual app mount
├── appInsights.ts        # App Insights singleton init
├── auth/                 # MSAL config, getAccessToken, login flow
├── theme/                # Theme provider, light/dark token wiring
├── features/
│   ├── indexer-host/     # MF host: load <IndexerApp />, route events, drive ref
│   ├── chat/             # Chat panel UI, SSE client, conversation lifecycle
│   ├── citations/        # Inline citation markers, source list, audit
│   └── viewer/           # PDF + image rendering, citation highlight overlay
├── components/           # Shared UI primitives (Splitter, Panel, Tooltip, Pill, IconButton)
├── hooks/                # Shared hooks (useApiClient, usePersistedReducer, useAbortable)
├── utils/                # Pure utilities (parseSse, problemDetails, driftGuard, idb helpers)
├── styles/               # global.css, design-token CSS variables
├── types/                # App-internal TS types not in /shared/types
└── setupTests.ts         # Jest polyfills

shared/types/             # Cross-module type vocabulary — see shared-types.md
```

`/shared/types/` lives at the project root (not under `src/`) to mirror the indexer's convention. `tsconfig.app.json` adds `"@shared/*": ["shared/*"]` path mapping.

---

## 2. Module contracts

### 2.1 `auth/`

**Owns:**
- MSAL `PublicClientApplication` instance configuration
- Login (popup), logout (popup)
- `getAccessToken()` — the canonical token-acquisition function
- `<AuthGate>` — renders children only when `AuthState.status === 'authenticated'`
- `<UserMenu>` — header dropdown with sign-out

**Exposes (from `auth/index.ts`):**
```ts
export { AuthProvider, AuthGate, UserMenu, useAuth, useAccessToken };
export type { AuthState, AccountInfo };
```

**Must not:**
- Read or write tokens to `localStorage` or IndexedDB (MSAL uses `sessionStorage`).
- Call any GlobalIndexer API endpoint directly — that's other modules' job.
- Handle URL routing.

### 2.2 `theme/`

**Owns:**
- Theme provider that toggles `[data-theme]` on `<html>`
- Inline `<script>` (in `index.html`) that reads `localStorage.theme-preference` synchronously before first paint
- `useTheme()` hook returning `{ theme, setTheme }`

**Exposes:**
```ts
export { ThemeProvider, useTheme };
export type { Theme };
```

**Must not:**
- Persist anything besides `theme-preference`.
- Read theme via `useEffect` (would cause flash).

### 2.3 `features/indexer-host/`

**Owns:**
- Lazy import of `mws_indexer/IndexerApp`
- `<IndexerHost>` — the React boundary that mounts the indexer
- Event router that dispatches `IndexerEvent`s to other modules' reducers
- URL routing (`/c/{id}?folderId=&documentId=`) — push-state on indexer events, parse on mount
- The `indexerRef` that other modules use via `useIndexerRef()` to call `selectCollection` / `revealDocument`

**Exposes:**
```ts
export { IndexerHost, useIndexerRef, useActiveCollection };
export type { IndexerHostState };
```

**Must not:**
- Render any chat or viewer UI (those are siblings).
- Persist any indexer-internal state (the indexer manages its own under `mws-indexer:`).
- Modify the host contract types (locked surface owned by the indexer project).

**Critical rule:** every `IndexerEvent` type must have a handler. New event types added to the contract block scaffold review until a handler is written.

### 2.4 `features/chat/`

**Owns:**
- `<ChatPanel>` — slide-in panel, header, composer, message list
- Conversation lifecycle (resolve existing on activate, lazy-create on first send, delete on Clear)
- SSE streaming client (`useSseChat()` hook wrapping fetch + ReadableStream + AbortController)
- Status row simulator (5-phase + fallback cycle)
- Model picker (Balanced/Powerful → llmProvider mapping)
- TanStack Query keys for conversations + history
- Message rendering (delegates citation `[N]` rendering to `citations/`)

**Exposes:**
```ts
export { ChatPanel, useChatSession };
export type { ChatSession, StreamingState, SimulatedPhase };
```

**Must not:**
- Render PDF or image content (delegate to `viewer/`).
- Mirror conversation messages to IndexedDB (server-authoritative).
- Render citation rectangles (delegate to `viewer/`).

### 2.5 `features/citations/`

**Owns:**
- `<CitationMarker>` — inline `[N]` superscript with tooltip + click handler
- `<SourceList>` — "View N sources" expander, grouped by fileName
- Citation audit (drift guard runs in `viewer/`; this module handles the "missing coords → strike-through" case before viewer is invoked)
- Citation numbering (per-response, 1-based, in order of first appearance — already provided by API)

**Exposes:**
```ts
export { CitationMarker, SourceList, useCitationClick };
export type { Citation, AuditedCitation };
```

**Must not:**
- Hold its own state — citations live inside `ChatSession.streaming.citations` and `ConversationHistory.messages[].citations`.
- Open the viewer directly — calls a callback supplied by `chat/` which composes the action (open viewer + `revealDocument`).

### 2.6 `features/viewer/`

**Owns:**
- `<DocumentViewer>` — right-side panel container
- pdf.js integration (canvas + text layer + highlight overlay; three-layer)
- Image renderer (blob-URL pattern for auth)
- Page navigation (numeric input, prev/next, PageUp/PageDown)
- Citation highlight overlay with drift guard (reject > 25% page height)
- "Locating citation" banner + "Couldn't locate" fallback

**Exposes:**
```ts
export { DocumentViewer, useViewer };
export type { ViewerState, CitationRect };
```

**Must not:**
- Fetch PDF content directly — uses pdf.js with a custom fetch loader from `hooks/useApiClient.ts`.
- Re-validate citation text content (the API has already done this; we only validate geometry via drift guard).
- Run client-side OCR (server-side vision pipeline handles scanned PDFs).
- Render Word/spreadsheet inline (deferred to v2 — show download button).

### 2.7 `components/` (shared UI primitives)

**Owns:**
- `<Splitter>` — draggable divider with persistence callback
- `<Panel>` — slide-in modal panel base (chat and viewer share this)
- `<Tooltip>` — accessible tooltip (`role="tooltip"`, ARIA-described-by)
- `<Pill>` — status badge with text + color (color-blind safe)
- `<IconButton>` — Phosphor icon wrapper with consistent sizing + a11y label
- `<LoadingSpinner>` — branded spinner

**Exposes:** named exports per file, no barrel (per `web-file-structure.md`).

**Must not:**
- Hold feature-specific state.
- Import from `features/`.

### 2.8 `hooks/` (shared)

| Hook | Purpose |
|---|---|
| `useApiClient()` | Returns a typed `fetch` wrapper that adds `Authorization`, parses ProblemDetails, captures `X-Operation-Id` |
| `usePersistedReducer<S, A>(key, reducer, initial)` | IndexedDB-backed reducer (per `web-persistence.md`) |
| `useAbortable<T>(fn)` | Wraps an async fn with AbortController; cancels on dep change/unmount |
| `useDebouncedValue<T>(value, ms)` | Standard debounce |
| `useUrlState()` | Push/parse URL state (`/c/{id}?folderId=&documentId=`) |

**Must not:** import from `features/` or `components/`.

### 2.9 `utils/` (pure)

| Util | Purpose |
|---|---|
| `parseSse(stream)` | `ReadableStream` → `AsyncIterable<SseEvent>` |
| `problemDetails(response)` | `Response` → typed ProblemDetails or null |
| `driftGuard(rect, pageHeight)` | `boolean` — true = render highlight, false = "couldn't locate" |
| `idb.get/set/delete(key)` | IndexedDB primitives wrapping `indexedDB` calls |
| `bytesToBlobUrl(stream)` | Stream → object URL for `<img>` |

**Must not:** import React. Pure functions only.

### 2.10 `telemetry/` (cross-cutting via `appInsights.ts`)

**Owns:**
- App Insights singleton init at app boot
- React error boundary that calls `trackException`
- `useTrackPageView()` hook that fires on route change

**Exposes:**
```ts
export { appInsights, ErrorBoundary, useTrackPageView };
```

**Must not:**
- Log any user content, AI response, or PII (per `web-error-logging.md` + general PII rules).
- Track per-token events from chat (would multiply event volume by message length).

---

## 3. Cross-cutting rules

### 3.1 Token uniformity

`auth.getAccessToken` is the **only** function that returns a bearer token. It is passed:
- to `<IndexerApp getAccessToken={...} />` so the indexer's API calls match
- to `useApiClient()` so the consuming app's API calls match

Both must resolve to the same audience. **Never** instantiate two MSAL apps or two scopes.

### 3.2 Error responsibility

| Error class | Handler |
|---|---|
| Network/4xx/5xx ProblemDetails from API | `useApiClient()` parses; calling code decides UX |
| 401 anywhere | Trigger MSAL refresh; retry once; on second 401 → `AuthState.status='expired'` |
| Indexer `error/unhandled` | Telemetry only (indexer renders its own fallback) |
| React render error | `<ErrorBoundary>` at app root + per-feature where graceful degradation matters |

### 3.3 No deep imports

Other modules import from a feature's `index.ts` only — never from internals. Enforced by ESLint `import/no-internal-modules` (configured in scaffold step).

### 3.4 No host-DOM mutation outside React

No `document.querySelector` mutations, no global `window.*` writes (other than the inline theme script in `index.html`). The indexer makes the same guarantee toward us.

### 3.5 React Compiler + memoization

If React Compiler is enabled in the build (deferred decision — see slice plan), automatic memoization applies. If not, `React.memo` + `useCallback` must be paired on list-item components per `web-component-architecture.md`.

---

## 4. What the consuming app does NOT own

- Collection / folder / document / batch lifecycle (indexer)
- Folder tree rendering, file list, upload UI, processing visibility (indexer)
- Document indexing pipeline, citation coordinate resolution, vector search, LLM routing (API)
- Conversation server-side persistence (API + Blob)
- The MWS theme tokens (defined by the indexer's `web-branding.md`; we override only via `themeOverrides` prop, which is deferred in v1)
