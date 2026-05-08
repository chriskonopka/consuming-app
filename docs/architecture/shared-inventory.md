# Shared Inventory

Cross-cutting utilities, shared UI primitives, and infra helpers. Every entry below is built once and reused by multiple slices. Building duplicates of any of these in a slice is a review failure.

> **Scaffold status (added by `/build-scaffold`):** all entries have a placeholder file at the listed location. Each placeholder compiles and exports the canonical signature; implementation lands in the slice noted under "Status."

---

---

## Cross-cutting utilities

### `useApiClient`
- **Interface:** `() => { get<T>(url: string, init?: RequestInit): Promise<T>; post<T>(url: string, body?: unknown, init?: RequestInit): Promise<T>; del<T>(url: string): Promise<T>; raw(url: string, init?: RequestInit): Promise<Response> }`
- **Location:** `/src/hooks/useApiClient.ts`
- **Status:** scaffolded (slice 2)
- **Behavior:**
  - Adds `Authorization: Bearer <token>` from `useAccessToken()`.
  - Prepends `API_BASE_URL` if URL is relative.
  - Parses `application/problem+json` responses as `ProblemDetails` and throws a typed `ApiError`.
  - Captures `X-Operation-Id` from response headers and logs to App Insights.
  - On 401, triggers MSAL silent refresh once; on second 401, sets `AuthState.status='expired'` and rethrows.
- **Consumers:** all features that hit the API (chat, viewer, indexer-host)

### `usePersistedReducer`
- **Interface:** `<S, A>(key: string, reducer: (s: S, a: A) => S, initialState: S): [S, Dispatch<A>]`
- **Location:** `/src/hooks/usePersistedReducer.ts`
- **Behavior:** Loads from IndexedDB on mount, merges with `initialState`, persists every state change (debounced 250ms). Errors swallowed with `.catch()` — falls back to in-memory state per `web-persistence.md`.
- **Consumers:** app-shell (panel state), any future slice needing local persistence

### `useAbortable`
- **Interface:** `<T>(asyncFn: (signal: AbortSignal) => Promise<T>, deps: DependencyList): { run: () => void; abort: () => void; status: 'idle' | 'pending' | 'success' | 'error'; data: T | null; error: Error | null }`
- **Location:** `/src/hooks/useAbortable.ts`
- **Status:** implemented (slice 3)
- **Behavior:** Wraps an async fn with an AbortController; aborts on unmount or dep change. Treats `DOMException(AbortError)` as a clean abort (status returns to `idle`, no error surfaced).
- **Consumers:** chat (SSE streaming)

### `useDebouncedValue`
- **Interface:** `<T>(value: T, ms: number): T`
- **Location:** `/src/hooks/useDebouncedValue.ts`
- **Status:** implemented (slice 3)
- **Consumers:** chat (status row fallback timing), viewer (page navigation input)

### `useUrlState`
- **Interface:** `() => { documentSetId: string | null; folderId: string | null; documentId: string | null; pushCollection: (id: string | null) => void; pushDocument: (id: string | null) => void }`
- **Location:** `/src/hooks/useUrlState.ts`
- **Behavior:** Reads/writes the URL `/c/{id}?folderId=&documentId=` shape. Uses react-router-dom's `useNavigate` + `useParams` + `useSearchParams`. Push-state by default so back-button works.
- **Consumers:** indexer-host, app-shell

### `parseSse`
- **Interface:** `(stream: ReadableStream<Uint8Array>, signal: AbortSignal): AsyncIterable<{ event: string; data: string }>`
- **Location:** `/src/utils/parseSse.ts`
- **Status:** implemented (slice 3)
- **Behavior:** Reads the stream, splits on `\r?\n\r?\n` event boundaries, yields each event with name + raw data string. Multi-line `data:` fields join with `\n` per the EventSource spec; comment lines (`:`) are ignored; default event name is `'message'`. Caller parses `data` as JSON. Cancels the reader when the supplied `AbortSignal` aborts.
- **Consumers:** chat (SSE streaming)

### `problemDetails`
- **Interface:** `(response: Response) => Promise<ProblemDetails | null>`
- **Location:** `/src/utils/problemDetails.ts`
- **Behavior:** If `Content-Type` is `application/problem+json`, parses and returns; otherwise null. Used by `useApiClient` and direct callers (e.g. SSE pre-stream errors).
- **Consumers:** `useApiClient`, chat

### `driftGuard`
- **Interface:** `(rectHeight: number, pageHeight: number) => 'render' | 'reject'`
- **Location:** declared in `/shared/types/viewer.ts` (it's small enough to live with the constant)
- **Consumers:** viewer

### `bytesToBlobUrl`
- **Interface:** `(stream: ReadableStream<Uint8Array> | Blob): Promise<string>` — caller responsible for `URL.revokeObjectURL`
- **Location:** `/src/utils/bytesToBlobUrl.ts`
- **Consumers:** viewer (image rendering with auth)

### `idb` primitives
- **Interface:** `{ get<T>(key: string): Promise<T | null>; set<T>(key: string, value: T): Promise<void>; delete(key: string): Promise<void> }`
- **Location:** `/src/utils/idb.ts`
- **Behavior:** Thin wrapper over the `indexedDB` API. Uses a single object store named `app-state` in a database named `consuming-app`. Per `web-persistence.md`, never called directly from components — only by `usePersistedReducer`.
- **Consumers:** `usePersistedReducer`

---

## Shared UI primitives

### `<Splitter>`
- **Interface:** `{ direction: 'horizontal' | 'vertical'; resizeFrom?: 'left' | 'right'; widthPx: number; minPx: number; maxPx: number; onResize: (px: number) => void; ariaLabel: string }`
- **Location:** `/src/components/Splitter/`
- **Status:** implemented (slice 3)
- **Behavior:** Draggable divider. Pointer events for dragging (with capture); ArrowLeft/ArrowRight, ArrowUp/ArrowDown, Home, End for keyboard resize (10px steps; Home/End jump to min/max). `aria-orientation`, `aria-valuenow`/`min`/`max`, and `role="separator"` for assistive-tech announcement. Width clamped to `[minPx, maxPx]` regardless of input source. `resizeFrom` controls drag-direction sign (default `left`; the chat panel uses `left`, the viewer panel will use `right`).
- **Consumers:** chat (slice 3), viewer (slice 4)

### `<Panel>`
- **Interface:** `{ side: 'left' | 'right'; open: boolean; widthPx: number; onClose: () => void; ariaLabel: string; id?: string; children: ReactNode }`
- **Location:** `/src/components/Panel/`
- **Status:** implemented (slice 3)
- **Behavior:** Slide-in panel base. Focus trap (Tab cycles through focusable descendants), focus restore on close, Escape closes, backdrop click closes, `prefers-reduced-motion` honored (no slide animation). The optional `id` prop enables triggers to use `aria-controls`.
- **Consumers:** chat (`<ChatPanel>`), viewer (`<DocumentViewer>`)

### `<Tooltip>`
- **Interface:** `{ content: ReactNode; placement?: 'top' | 'bottom' | 'left' | 'right'; children: ReactElement }`
- **Location:** `/src/components/Tooltip/`
- **Behavior:** ARIA-described-by relationship; show on hover and keyboard focus; dismiss on Escape.
- **Consumers:** citations (`[N]` markers), components (`<Pill>` for full text on truncation), header

### `<Pill>`
- **Interface:** `{ label: string; tone: 'neutral' | 'info' | 'success' | 'warning' | 'error'; ariaLabel?: string; truncated?: boolean }`
- **Location:** `/src/components/Pill/`
- **Behavior:** Color + text label (color-blind safe, per `web-accessibility.md`). Tooltip-on-hover when `truncated`.
- **Consumers:** citations (source list doc-type pill — deferred), viewer header (file type). (Removed: chat model-picker display — picker deferred per REQUIREMENTS.md §4.9.)

### `<IconButton>`
- **Interface:** `{ icon: PhosphorIconType; ariaLabel: string; onClick: () => void; disabled?: boolean; tone?: 'default' | 'primary' | 'danger'; type?: 'button' | 'submit'; ariaPressed?: boolean; ariaExpanded?: boolean; ariaControls?: string }`
- **Location:** `/src/components/IconButton/`
- **Status:** implemented (slice 3)
- **Behavior:** Phosphor regular-weight icon (20×20 inside a 40×40 button area), navy/teal per theme. Visible focus ring. `aria-label` mandatory. Toggle/expand semantics supported via `aria-pressed`/`aria-expanded`/`aria-controls` for triggers like the chat-panel toggle.
- **Consumers:** every feature

### `<LoadingSpinner>`
- **Interface:** `{ ariaLabel: string; size?: 'small' | 'medium' | 'large' }`
- **Location:** `/src/components/LoadingSpinner/`
- **Status:** implemented (slice 3)
- **Behavior:** Branded ring spinner with `role="status" aria-live="polite"` and a visually-hidden text label so screen readers announce loading. Honors `prefers-reduced-motion` (no spin animation).
- **Consumers:** chat (Suspense fallback while indexer loads, Composer slot), viewer (page render state — slice 4)

---

## Infra helpers

### `appInsights` singleton
- **Interface:** Default export — initialized `ApplicationInsights` instance.
- **Location:** `/src/appInsights.ts`
- **Behavior:** Reads `APPLICATIONINSIGHTS_CONNECTION_STRING` from build-time env (DefinePlugin). Initialized once at module load. Re-initializing is forbidden.
- **Consumers:** telemetry, all features (via `import { appInsights }` for `trackEvent` / `trackException`)

### `<ErrorBoundary>`
- **Interface:** `{ children: ReactNode; fallback?: ReactNode }`
- **Location:** `/src/components/ErrorBoundary/` (template stub already exists at `/src/ErrorBoundary.tsx` — to be moved into the folder structure during scaffold)
- **Behavior:** Standard React error boundary. Calls `appInsights.trackException({ exception })` on `componentDidCatch`. Renders `fallback` or a default branded fallback.
- **Consumers:** app-shell root, optionally per-feature for graceful degradation

### `useTrackPageView`
- **Interface:** `() => void`
- **Location:** `/src/telemetry/useTrackPageView.ts`
- **Behavior:** Subscribes to react-router-dom location changes; fires `appInsights.trackPageView({ name, uri })` on each. Strips query string (no PII in telemetry).
- **Consumers:** app-shell

### `MsalProvider` configuration
- **Interface:** `<MsalAppProvider>{children}</MsalAppProvider>`
- **Location:** `/src/auth/MsalAppProvider.tsx`
- **Behavior:** Wraps `@azure/msal-react`'s `MsalProvider` with our preconfigured `PublicClientApplication`. Sets active account on login; clears on logout; emits `AuthState` updates via context.
- **Consumers:** app-shell

### `useAccessToken`
- **Interface:** `() => GetAccessToken`
- **Location:** `/src/auth/useAccessToken.ts`
- **Behavior:** Returns the canonical token-acquisition function. Tries `acquireTokenSilent`, falls back to `acquireTokenPopup` on `InteractionRequiredAuthError`. Same instance handed to `<IndexerApp>` and to `useApiClient`.
- **Consumers:** indexer-host, useApiClient (transitively all features)

---

## What's intentionally NOT in this inventory

- Feature-internal hooks (e.g. `useChatSession`, `useViewer`) live in their feature folders, not in `/src/hooks/`.
- A generic toast / notification system is **deferred** — error notices in v1 are inline (per `web-coding-standards.md` "show user-friendly error states") rather than a toast queue. Adding a toast system later is one new component in `components/`.
- A `useFocusTrap` hook is folded into `<Panel>` (no other consumer in v1). If a future modal needs it standalone, lift it into `hooks/`.
- A keyboard-shortcut registry is **deferred** — v1 keyboard handling (Enter, Shift+Enter, Escape, PageUp/Down) is inlined per component, which is simpler and matches the indexer's pattern.
