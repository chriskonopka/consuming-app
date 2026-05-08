# Consuming App — Business & Functional Requirements

**Project:** Test consuming app for the reusable indexer (working name: `test-app`)
**Version:** 1.0
**Date:** 2026-05-06
**Status:** Draft
**Audience:** Product, frontend engineering
**Scope:** Frontend only. The GlobalIndexer API is owned and documented separately (`../reusable-indexer/frontend-api-contract.md`).

---

## 1. Overview

This document specifies the requirements for the **consuming app** — a Module Federation **host** that loads the reusable indexer (`mws_indexer/IndexerApp`) at runtime and adds the chat, citation, and document-viewer experience on top of it.

The reusable indexer ships **ingestion + collection management only** (collections sidebar, folder tree, upload, file list, processing visibility, failure triage). Everything else from the original `DocCollectionChat_BUSINESS_REQUIREMENTS_FRONTEND.md` belongs here:

| Area | Owner |
|---|---|
| Collections / folders / upload / processing / failure triage | Indexer (already built) |
| Authentication (MSAL / Entra ID) | Consuming app |
| Module Federation host wiring | Consuming app |
| Chat with documents | Consuming app |
| Verifiable citations | Consuming app |
| Document viewer with citation highlighting | Consuming app |
| App-shell layout (combining indexer + chat + viewer) | Consuming app |
| App Insights initialization | Consuming app |

This doc references `../reusable-indexer/DocCollectionChat_BUSINESS_REQUIREMENTS_FRONTEND.md` (the original) by section number rather than restating those features. Read both documents together.

---

## 2. Module Federation Host Integration

### 2.1 Stack & version pinning

- **React 19**, **TypeScript**, **Webpack 5**, **`@module-federation/enhanced`** — must match the indexer's versions exactly. The indexer's `package.json` is the source of truth; this app's `package.json` must use the same major/minor for `react`, `react-dom`, and the federation plugin.
- **TanStack Query** for server state, **React Context + `useReducer`** for client state — same conventions as the indexer's `web-state-management.md` rule.
- **SCSS Modules** for styling (matches indexer's `web-styling.md`).
- **Phosphor Icons (regular weight)** for icons (matches indexer's `web-branding.md`).

### 2.2 Webpack host config

The consuming app must declare the indexer as a **remote** in `ModuleFederationPlugin`:

```js
new ModuleFederationPlugin({
  name: 'consuming_app',
  remotes: {
    mws_indexer: `mws_indexer@${process.env.INDEXER_REMOTE_URL}/remoteEntry.js`,
  },
  shared: {
    react:             { singleton: true, requiredVersion: false, eager: false },
    'react-dom':       { singleton: true, requiredVersion: false, eager: false },
    'react-dom/client':{ singleton: true, requiredVersion: false, eager: false },
  },
})
```

- `INDEXER_REMOTE_URL` resolves at runtime — `http://localhost:3001` for local dev (the indexer's `webpack-dev-server` port), an Azure Static Web Apps / Front Door URL in deployed environments.
- The host must boot via an async `bootstrap.tsx` pattern (`import('./bootstrap')`) so MF can resolve shared chunks before any application code runs.

### 2.3 Loading the indexer

```tsx
const IndexerApp = React.lazy(() => import('mws_indexer/IndexerApp'));
type { IndexerAppProps, IndexerEvent, IndexerHandle } from 'mws_indexer/types';
```

The host renders `<IndexerApp />` inside a `<Suspense fallback={…}>` boundary. The fallback is the consuming app's branded loading state, not a generic spinner.

### 2.4 Props passed to `<IndexerApp />`

The host contract is locked in `../reusable-indexer/shared/types/host-contract.ts`. The consuming app passes:

| Prop | Source |
|---|---|
| `apiBaseUrl` | Env var `API_BASE_URL` — e.g. `https://globalapi-test-dcfad7eka5b0gkhk.z01.azurefd.net`. No trailing slash. |
| `getAccessToken` | MSAL-backed function (see §3.4). Returns the same token the consuming app uses for its own API calls — same audience, same scope. |
| `appInsights` | Shared App Insights instance owned by the host (see §9). Indexer logs through it; host avoids double-init. |
| `themeOverrides` | Optional. Defer for v1 — let the indexer use its built-in MWS tokens. |
| `initialTheme` | Optional. Resolve from the host's persisted theme preference (`localStorage.theme-preference`). |
| `initialState` | `{ documentSetId, folderId, documentId }` — populated from URL on mount (see §2.7). |
| `onEvent` | Single dispatcher that routes `IndexerEvent` into the host's reducers (see §2.5). |

### 2.5 Event handling

The consuming app must handle every `IndexerEvent` type:

| Event | Consuming-app reaction |
|---|---|
| `auth/expired` | Trigger MSAL silent token refresh. On success, force-remount `<IndexerApp />` (key change). On failure, show interactive login. The indexer stops calling the API until remounted — do not ignore this event. |
| `collection/activated` | Update host state with the new `(documentSetId, accessRole)`. Auto-resolve a conversation for this collection (see §4.1). The chat panel's scope updates; if a viewer is open and the document doesn't belong to the new collection, close it. |
| `collection/list-changed` | Debounced; the host doesn't currently maintain its own collection-aware UI outside the chat scope. Reserved for future use — wire the handler but make it a no-op for v1. |
| `document/selected` | Open the document viewer (§5) for this `documentId`. No citation context — viewer opens at page 1. |
| `error/unhandled` | Log via App Insights `trackException` with the supplied `operationId` and `messageForLogs`. Do not re-render anything — the indexer keeps its own fallback. |

### 2.6 Imperative ref usage

Take a ref to `<IndexerApp />` so the host can drive selection:

- **URL-driven collection switch.** When the URL changes to `/c/{documentSetId}`, the host calls `indexerRef.current?.selectCollection(id)`. The indexer mirrors via `collection/activated`.
- **Citation click → reveal document.** When the user clicks an inline citation in chat, the host (a) opens the viewer at the cited page, (b) calls `indexerRef.current?.revealDocument(documentId)` so the file list scrolls to and highlights the document. Best-effort, no-op if the document isn't in the active collection.

### 2.7 Deep linking

URL shape: `/c/{documentSetId}?folderId={folderId}&documentId={documentId}`. On first mount:

1. Parse the URL and pass `{documentSetId, folderId, documentId}` as `initialState` to the indexer.
2. If `documentId` is present, also open the viewer at that document.

Subsequent URL updates are driven by indexer events (`collection/activated`, `document/selected`) — push-state, not replace-state, so back-button works.

### 2.8 Layout shell

The consuming app owns the page chrome:

- **Header bar** — app name, theme toggle (light/dark, propagates to indexer via re-render), user menu (account info, sign-out), App Insights connection status indicator (dev only).
- **Main canvas** — `<IndexerApp />` fills the available width. The indexer renders its own collections sidebar + folder tree + file list internally.
- **Chat panel** — overlays the main canvas from the left as a slide-in panel. Width adjustable on desktop via splitter (persists per §6.3). Tablet: fixed responsive width. Mobile: full-screen.
- **Viewer panel** — overlays from the right. Same responsive behavior. When both chat and viewer are open on desktop, a splitter sits between them and the main canvas is visually pushed/dimmed underneath. Original doc §5.1 describes this layout.

---

## 3. Authentication (MSAL / Entra ID)

### 3.1 App registration requirements

Owner of the test tenant must create:

1. **A SPA app registration** for this consuming app.
   - Redirect URI: `http://localhost:3000` (dev), production URL TBD.
   - Implicit grant: leave OFF — use authorization code + PKCE.
2. **API permission** on the existing GlobalIndexer API app reg's user-impersonation scope (e.g. `api://<api-app-id>/access_as_user`).
3. Admin consent granted for the API permission.

The consuming app and the indexer use the **same access token** — the indexer's `getAccessToken` callback returns the same value the consuming app uses for its own API calls. No separate tenants, no separate audiences.

### 3.2 Library

- **`@azure/msal-browser`** + **`@azure/msal-react`**.
- `PublicClientApplication` configured with the SPA app reg's `clientId`, `authority`, and `redirectUri`.

### 3.3 Login flow

- Default: `loginPopup` (no full-page redirect, preserves app state).
- `MsalAuthenticationTemplate` wraps the app shell — unauthenticated users see a "Sign in" screen.
- After login, the user lands on the last URL they visited (or `/` if first visit).
- Sign-out: `logoutPopup` from the user menu.

### 3.4 Token acquisition for `getAccessToken`

```ts
const getAccessToken = useCallback(async (): Promise<string> => {
  const account = msalInstance.getActiveAccount();
  if (!account) throw new Error('no_account');
  try {
    const result = await msalInstance.acquireTokenSilent({
      account,
      scopes: [API_SCOPE],
    });
    return result.accessToken;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      const result = await msalInstance.acquireTokenPopup({ scopes: [API_SCOPE] });
      return result.accessToken;
    }
    throw err;
  }
}, []);
```

- The same function is passed to `<IndexerApp getAccessToken={getAccessToken} />` and is used for all the consuming app's own fetches.
- MSAL handles caching, refresh-token rotation, and `Retry-After`. No hand-rolled refresh logic.
- An empty / thrown token surfaces from the indexer as `auth/expired`. The host's response: see §2.5.

### 3.5 Token storage

- Default MSAL storage: `sessionStorage`. Do not switch to `localStorage` without a security review.
- Per the indexer's `web-persistence.md` rule (and standard hygiene): never store tokens in IndexedDB.

---

## 4. Chat With Documents

### 4.1 Conversation model — auto-managed

The API supports multiple named conversations per (user, collection) via `POST /document-sets/{id}/conversations`, `POST /conversations/list`, `PATCH`, `DELETE`. **For v1, the consuming app hides this model from the user** — at any moment there is exactly one "current conversation" per (user, collection). Behavior:

- On `collection/activated`, the consuming app:
  1. Calls `POST /document-sets/{documentSetId}/conversations/list` with `{page: 1, pageSize: 1}`.
  2. If a conversation exists, treat its `conversationId` as current. Load history via `POST /history`.
  3. If none exists, defer creation — call `POST /conversations` lazily on the first user message.
- **"Clear" button** in the chat header: confirms, then `DELETE /conversations/{convId}` and resets local state. The next message creates a new conversation.
- The conversation's `title` is server-defaulted; the user never sees or edits it in v1.

This matches the original doc's framing ("Every turn is persisted per (user, collection)") while staying compatible with the API's richer model. A future v2 can expose conversation lists without breaking v1's data.

### 4.2 Chat panel UI

Per original doc §4.2.1:

- Slide-in panel on the left (desktop), full-screen on mobile.
- Header: title ("Ask questions"), Clear button (visible only when history exists), close button.
- Empty state: sparkle icon + "Ask anything about this collection" prompt.
- Width persisted across sessions (see §6.3).

### 4.3 Chat input

Per original doc §4.2.2:

- Multi-line `<textarea>` with autosize.
- **Enter** sends; **Shift+Enter** newline.
- Send button (paper-plane icon) disabled while a response is streaming OR input is empty.
- After send, input clears, focus returns.
- **Length validation** — message body cap is 64 KB (server-enforced; see API contract). Client rejects above 64 KB with humanized message ("Message too long — keep under 64,000 characters").

### 4.4 Streaming SSE client

The consuming app sends user messages via `POST /document-sets/{id}/conversations/{convId}/messages` with `Accept: text/event-stream`. Implementation rules:

- Use **`fetch` with a streaming `ReadableStream` body reader** — not `EventSource` (which doesn't support `POST`, custom headers, or `Authorization`).
- Parse the stream as SSE: `event:` line names the channel, `data:` line is JSON.
- Three event channels:
  | Event | Action |
  |---|---|
  | `token` | Append `data.text` to the rendered assistant message in order. |
  | `citation` | Store `{marker, page, x, y, w, h, fileName}` in the message's citation list. Render the inline `[N]` superscript when the LLM also emits `[cite:N]` text. |
  | `error` | Stop reading. Render a non-blocking error notice ("Stream interrupted — try again"). The user message is NOT appended to history server-side; the input remains populated for retry. |
- **Pre-stream errors** (validation, ownership, conversation not found) come back as ProblemDetails. Render the `detail` field as the error notice.
- **Cancellation** — an "Abort" button replaces "Send" while streaming. Click → `abortController.abort()`. Server treats abort as cancellation, not failure; no partial message persisted; local state discards the streamed content.

### 4.5 Streaming status row

Per original doc §4.2.3, a status row above the streaming response shows what the system is doing. **The API's SSE stream does not emit explicit status events** — only `token`, `citation`, `error`. The status row is a **client-side simulation** synchronized to the stream:

- Phases (display in this order):
  1. "Reading your collection" — shown immediately on send, before first byte.
  2. "Picking documents" — after ~500ms with no tokens.
  3. "Reading selected files" — after ~1.2s with no tokens.
  4. "Thinking…" — after ~2s with no tokens.
  5. "Finalizing response" — after first `token` event arrives.
  6. Hidden — once the stream completes.
- **Fallback cycle** — if no real progression has happened for ~1.5s within a phase, rotate through 2–3 reassuring sub-phrases per phase every ~2.5s so the user sees forward motion.
- All phase text and timings are client-side constants. If the API later adds explicit status events, this section gets revisited.

### 4.6 Follow-up suggestions

**Deferred to v2.** The API does not currently return follow-up suggestions on the SSE stream. Until it does, original doc §4.2.4 is not implemented.

### 4.7 Chat history

- On `collection/activated` for an existing conversation, call `POST /document-sets/{id}/conversations/{convId}/history` with `{}` (full load) and render the messages array.
- Messages persist server-side. Switching collections away and back restores the conversation (per original doc §4.2.5) by re-fetching history.
- Client-side caching: TanStack Query with `staleTime: 0, gcTime: 5min` for history queries. Invalidate after every assistant response completes.
- **Browser persistence** — only the chat-panel splitter position and the panel open/closed state. Conversation content is server-authoritative; do not mirror it to IndexedDB.

### 4.8 Source list

Per original doc §4.2.6:

- Below the assistant response, a "View N sources" expander reveals the documents that grounded the answer. Sources are derived from the `citations` array — group citations by `fileName`, dedupe.
- Each source row: file name, doc-type pill (deferred — needs `GET /documents/{id}` lookup; v1 shows just file name), section heading (not currently in `citation` payload — defer).
- Click a source → open viewer at the first cited page for that file, and call `revealDocument(documentId)` on the indexer ref.

### 4.9 Model selection — single model in v1

**v1 hardcodes `llmProvider: 'Claude'` on every `POST .../messages` body.** No picker UI. The API's Claude path currently resolves to **Claude Opus 4.7** server-side; v1 inherits that choice without exposing it to the user.

The original doc's "Quick / Balanced / Powerful" three-tier picker (and the prior v1 plan to ship Balanced/Powerful as a two-option dropdown) is **deferred** until either (a) the API exposes model-level selection beyond `'Claude' | 'OpenAi'`, or (b) product confirms multiple providers should be user-selectable. Until then, the chat header has no model control. See §10.

---

## 5. Citations & Document Viewer

### 5.1 Inline citation markers

Per original doc §4.3.1:

- Every `[cite:N]` token in the assistant text renders as a clickable superscript `[N]`.
- Numbering is per-response, 1-based, in order of first appearance — already provided by the API.
- Hover → tooltip: "{fileName}, page {page}".
- Click → open viewer at `(documentId-resolved-from-fileName, page, citation rect)`.

### 5.2 Citation audit — simplified

The original doc §4.3.2 spec assumed the client verified citations against extracted text. **The API's `CitationBuilderSkill` already validates `[cite:N]` against extracted lines and silently discards hallucinations** before the response is streamed. Therefore:

- v1 does NOT re-verify citation text content.
- v1 DOES apply the **drift guard** (§5.6) — a rendered highlight covering > 25% of visible page height is rejected as "Couldn't locate this quote on the page." This catches the rare case where API coordinates land on a region that doesn't make visual sense.

If a citation arrives without coordinates (`x|y|w|h` all 0 or negative), render it as `[N]` with a strike-through and tooltip "Unverified — coordinates missing." This preserves the original doc's user-visible "honest about misses" guarantee.

### 5.3 Where the viewer opens

Per original doc §4.5.1:

- Inline citation click → viewer opens at cited page with citation rect highlighted.
- Source list item click → viewer opens at the first cited page for that file with that citation highlighted.
- Indexer's `document/selected` event → viewer opens at page 1, no highlight.

Right-side panel on desktop, full-screen overlay on mobile.

### 5.4 PDF rendering

- **Library:** **`pdfjs-dist`** (Mozilla pdf.js) directly. Reasons: standalone, no React wrapper lock-in, well-maintained, supports text layer + custom annotation overlays needed for highlight rectangles.
- Page rendered to a `<canvas>`; selectable text layer (`<div class="textLayer">`) above it; highlight overlay (`<div class="highlightLayer">`) above that. Three-layer architecture matches the original doc §4.5.4.
- PDF source: stream from `GET /documents/{documentId}/content` with the bearer token. Use a custom `fetch`-based loader passed to pdf.js's `getDocument({ url, httpHeaders, withCredentials })`.
- Range requests (`Range: bytes=...`) supported by the API — pdf.js uses these by default for large PDFs. Accept-ranges + 206 handling per the API contract.

### 5.5 Render strategy by format

| Format | Render | Notes |
|---|---|---|
| **PDF** | pdf.js (canvas + text layer + highlight overlay) | See §5.4. |
| **Image** (`.png`, `.jpg`, `.tiff`, …) | `<img>` from `GET /documents/{id}/content` with `Authorization` header — fetched via blob URL because `<img>` can't carry headers directly. | Citation highlight: an absolutely-positioned `<div>` overlay sized from the API's `(x, y, w, h)`. Image is treated as page 1. |
| **Word, spreadsheet, other** | **Deferred to v2.** The API converts Word documents to PDF (`ConvertedPdfBlobPath` per the extraction rule); a future iteration can render that PDF instead. v1 shows a "Preview not available — open the original" button that triggers a download via `GET /content`. |

### 5.6 Citation highlighting

When the viewer opens with a citation:

1. Show "Locating citation on page {N}…" banner while the page renders.
2. Render the page; when ready, draw a highlight rectangle at `(x, y, w, h)` PDF points, scaled by the current render scale factor.
3. **Drift guard** — if the rectangle spans more than 25% of the visible page height, reject the highlight and show "Couldn't locate this quote on the page." (Catches occasional bad coordinates.)
4. **Multi-line quotes** — the API returns one bounding rectangle per `citation` event. If a quote spans multiple lines on the page (rare, since the citation event resolves to a single line per the extraction rules), v1 renders one rectangle. Multi-rect support is deferred until the API emits multiple events for one cited quote.
5. Auto-scroll: center the highlighted rectangle in the viewport.
6. Highlight color: soft yellow overlay using `color-mix(in srgb, var(--color-warning) 40%, transparent)` so the underlying text remains legible. Per `web-styling.md`, no hardcoded `rgba`.

**Removed from original doc spec** (no longer needed because the API resolves coordinates):

- Fuzzy quote matching / character-spaced extraction normalization (§4.5.6).
- OCR fallback (§4.5.7) — the API runs the vision pipeline server-side during ingestion.
- Cross-page quote scanning when the cited page is wrong (§4.5.5.2-3) — the API's coordinates are authoritative.
- The "cited page is X but quote was found on Y" informational banner.

If the v1 drift guard fires more than ~1% of the time in production, revisit and add some of these features back.

### 5.7 Document header

Per original doc §4.5.2:

- Title: server-side display name when available; otherwise `fileName` from `GET /documents/{id}`.
- Metadata: doc type (from `fileType`), file date (defer — not currently in the API response; show upload `createdAt`), page count (from pdf.js after load).
- Close button (top-right).

### 5.8 Page navigation

Per original doc §4.5.3:

- Numeric page input + previous/next buttons.
- Current page / total pages always visible.
- Keyboard: PageUp / PageDown when viewer has focus.

---

## 6. Cross-Cutting

### 6.1 Responsive layout

Same breakpoints as original doc §5.1:

- **Desktop (≥ 1201 px)** — chat panel + viewer side-by-side, draggable splitter between them, indexer pushed/dimmed underneath.
- **Tablet (768 – 1200 px)** — fixed-width chat panel; viewer overlays.
- **Mobile (< 768 px)** — chat and viewer stack full-screen with backdrop; only one foregrounded at a time.

### 6.2 Theming

Per original doc §5.2 + the indexer's `web-branding.md`:

- Light + dark via `[data-theme="light"]` / `[data-theme="dark"]` on `<html>`.
- First load: `prefers-color-scheme` media query.
- Theme toggle in header bar persists choice to `localStorage.theme-preference` (the only sanctioned `localStorage` key per `web-persistence.md`).
- Theme initialization via inline `<script>` in `<head>` to prevent flash (matches indexer's `web-performance.md`).
- The host's theme propagates to the indexer via `initialTheme` prop on mount and via re-mount on user toggle.

### 6.3 Persistence (browser-local)

| Key | Storage | Purpose |
|---|---|---|
| `theme-preference` | localStorage | Light/dark choice. |
| `consuming-app:chat-panel-width` | IndexedDB via `usePersistedReducer` | Splitter position. |
| `consuming-app:viewer-panel-width` | IndexedDB | Splitter position. |
| `consuming-app:chat-panel-open` | IndexedDB | Last open/closed state. |

The indexer manages its own persistence under the `mws-indexer:` namespace — no overlap.

### 6.4 Keyboard

- **Enter** sends a chat message; **Shift+Enter** newline (per §4.3).
- **Escape** closes the viewer if open; otherwise closes the chat panel.
- **PageUp / PageDown** navigates pages in the viewer when focused.
- All interactive elements reachable via standard tab order.

### 6.5 Accessibility

- WCAG 2.1 AA baseline. ESLint `jsx-a11y/recommended` + jest-axe assertions per indexer's `web-accessibility.md` and `web-testing.md` rules.
- Status row (§4.5) and citation "Locating…" banner use ARIA live regions (`aria-live="polite"`).
- Citation superscripts are `<button>` elements (not `<span>`) so they're keyboard-focusable and screen-reader-announced as actions.
- Modal panels (chat, viewer) trap focus and return focus to trigger on close.

### 6.6 Performance expectations (perceived)

- First chat token rendered within ~2 s of pressing Send under normal conditions; status-row fallback cycle (§4.5) covers slower paths.
- Citation click → viewer with highlight: target ≤ 2 s for born-digital PDFs. (OCR / scanned-PDF target from original doc §5.6 is now an API concern, not a client concern.)

### 6.7 Errors and empty states

- Plain-English sentences with a suggested next step. Never expose `operationId`, status codes, or stack traces to the user (log them via App Insights instead).
- Per original doc §5.7.

---

## 7. App Insights

Per the indexer's `web-error-logging.md`:

- Host owns initialization. Single `ApplicationInsights` instance created at app entry.
- Connection string from env var `APPLICATIONINSIGHTS_CONNECTION_STRING` — same as the API's, safe to expose in browser bundles.
- Pass the instance to `<IndexerApp appInsights={…} />` so the indexer logs through the same telemetry pipeline.
- React error boundary at the app root calls `appInsights.trackException()` on caught errors.
- Track on every API call: `operationId` (from `X-Operation-Id` response header), endpoint, status, duration. Never log message content, document text, or PII.

---

## 8. Testing Requirements

Inherits the indexer's `web-testing.md` and `web-accessibility.md` standards:

- **Jest + React Testing Library** for unit/integration. Minimum 80% coverage (branches/functions/lines/statements).
- **jest-axe** assertion on every component test.
- **Playwright** E2E for critical flows:
  - Sign in → indexer mounts → click a collection → chat panel opens → send message → tokens stream → citation appears → click citation → viewer opens at page → highlight visible.
  - Send message → cancel mid-stream → next message works.
  - Read-only viewer (shared collection): same chat flow works; no upload UI visible anywhere.

---

## 9. Acceptance Criteria

### Auth
- A first-time user signs in via popup, lands on the app shell, and the indexer mounts with their collections list.
- After 1 hour of idle, the next API call triggers silent token refresh transparently. Failure surfaces as the "Sign in" screen, not an error toast.

### Indexer integration
- Clicking a collection in the indexer sidebar updates the URL to `/c/{id}` and the chat panel re-scopes to that collection.
- Clicking a ready file row in the indexer's file list opens the consuming app's viewer at page 1 of that document.

### Chat
- The user asks "What is the governing law in the master agreement?" and:
  - Sees a status row stepping through the simulated phases.
  - Sees a streaming answer materialize with at least one inline `[1]` citation.
  - Clicking `[1]` opens the viewer at the cited page within ~2 s with a soft yellow highlight rectangle.
- "Clear" deletes the conversation server-side; the next message starts a new one.
- Switching collections away from a chat thread and back restores the full conversation from the API.

### Citations & viewer
- A citation whose API-supplied rectangle covers > 25% of page height renders with strike-through and "Couldn't locate" tooltip — never as a misleading mark.
- A scanned PDF's citation highlights at the API-supplied coordinates (vision pipeline ran server-side). No client-side OCR.
- PDF page navigation via numeric input, prev/next buttons, and PageUp/PageDown all work.

### Read-only
- A user opens a collection shared with them: the indexer marks it shared/read-only. The chat input remains **enabled** — read-only viewers can chat against the shared corpus per original doc §4.6. The viewer's chat history is private to that viewer (server-scoped per user, per the API's conversation model).
- No upload, rename, delete, or mutation controls appear anywhere on the screen for shared collections — both the indexer (which owns those controls) and the consuming app's chrome respect `accessRole === 'Shared'`.

### MF & deployment
- Deploying a new indexer version with no changes to its host contract requires no consuming-app rebuild — refreshing the consuming app pulls the new `remoteEntry.js` and the new indexer.

---

## 10. Out of Scope (Deferred)

- Follow-up question suggestions (§4.2.4 of original doc).
- "Quick" model option (until the API exposes a third tier).
- Word / spreadsheet inline preview in the viewer (downloads instead in v1).
- Multi-rectangle highlights for quotes spanning multiple lines.
- Conversation lists exposed in UI (single auto-managed conversation per collection in v1).
- Doc-type pills + section headings in the chat source list.
- Theme override props sent to the indexer (use indexer defaults in v1).
- Model picker UI (single hardcoded `llmProvider: 'Claude'` → Claude Opus 4.7 in v1; persisting a picker selection only becomes relevant once the picker exists).
- Office mobile platform support beyond what the indexer covers.

---

## 11. Glossary (additions to original doc)

- **Host** — the consuming app, running Module Federation as the host that loads remotes.
- **Remote** — the reusable indexer, exposed at `mws_indexer/IndexerApp` and `mws_indexer/types`.
- **Conversation** — server-side persisted thread of messages within a (user, collection). The consuming app v1 surfaces only one conversation per collection at a time.
- **MSAL** — Microsoft Authentication Library; the SDK that handles Entra ID login + token acquisition.

---

*End of document.*
