# Slice Plan

> **Read first:** `.claude/rules/slicing.md`. A slice is one user-visible capability, not a horizontal layer. Default to the smallest plan that ships a working capability end-to-end.

---

## Locked parameters

- **Target slice count:** **5**
- **User-capability count in spec:** ~6–8 (sign in, view collections via indexer, ask questions, view citations, switch model, clear conversation, read-only sharing, layout polish). 5 slices is **0.7×** the user-capability count — slightly under the typical 1–3× range, justified below.
- **Reviewable LoC ceiling:** **6,000** lines per slice (lowered from the typical 5,000–8,000 because security-sensitive surfaces — auth, chat with AI, document viewer with auth-stream — appear in this app).
- **Drift cap (verbatim per `slicing.md`):** *"slice count cannot grow by more than 25% during Step 3 without an architecture-doc update and a re-review."* 25% × 5 = 1.25, so a maximum of **6 slices** is permitted before re-review.

### Why 5 slices and not 6–8

The smell test in `slicing.md` warns against splitting too fine when "two adjacent slices edit the same file" or "a slice's only deliverable is wire DI." Splitting auth and the app shell would do exactly that — auth has no UI without the shell, and the shell has nothing to render without auth. Same for citations and viewer: a citation marker that doesn't open a viewer ships zero user value. Bundling them keeps each slice an end-to-end capability.

The slices below are ordered by build dependency. Each one ships a real capability; later slices add value without rewriting earlier ones.

---

## Slice 1: App shell + Auth + Telemetry

- **Spec sections:** REQUIREMENTS.md §2.8 (layout shell), §3 (auth), §6.2 (theming), §6.3 (persistence — theme + panel state plumbing), §7 (App Insights)
- **User capability:** *"User signs in via Entra ID and lands on a themed app shell. Sign-out works. Theme toggle persists across reloads."*
- **Scope:**
  - Add deps: `@azure/msal-browser`, `@azure/msal-react`, `react-router-dom@^7`
  - `src/auth/`: MSAL config, `<MsalAppProvider>`, `<AuthGate>`, `useAuth()`, `useAccessToken()`, `<UserMenu>`
  - `src/theme/`: theme provider, inline init script in `index.html`, `useTheme()`
  - `src/telemetry/`: relocate `appInsights.ts`, add `<ErrorBoundary>` (move from `src/ErrorBoundary.tsx`), `useTrackPageView()`
  - `src/app-shell/`: `<AppShell>` with header bar (app name, theme toggle, user menu), main canvas placeholder, panel slots, persistence wiring (`usePersistedReducer` for chat/viewer panel state — the panels themselves come in later slices)
  - `src/main.tsx` + `src/bootstrap.tsx`: MF async-boundary pattern (no remote yet, but the structure is in place)
  - `src/hooks/usePersistedReducer.ts` + `src/utils/idb.ts`
  - Routing skeleton: `<BrowserRouter>` with `/` and `/c/:documentSetId` placeholder routes
  - Tests: MSAL flow (mocked), theme toggle persists, axe across light + dark + sign-in screen + signed-in shell
  - E2E: sign in → see shell → toggle theme → reload → theme persists → sign out
- **Estimated LoC:** ~2,000

## Slice 2: Indexer host integration

- **Spec sections:** REQUIREMENTS.md §2 (MF host integration end-to-end)
- **User capability:** *"User browses collections, folders, and files via the embedded indexer. URL reflects the active collection (`/c/{id}`). Back-button works."*
- **Scope:**
  - Add deps: `@module-federation/enhanced` (matching indexer's exact version)
  - `webpack.config.js`: add `ModuleFederationPlugin` consuming `mws_indexer/IndexerApp` and `mws_indexer/types`; add `INDEXER_REMOTE_URL` env var; add `splitChunks` for vendor chunk per `web-performance.md`; add `DefinePlugin` for `API_BASE_URL` and `INDEXER_REMOTE_URL`
  - `src/features/indexer-host/`: lazy-loaded `<IndexerHost>` wrapping `<IndexerApp>`, event router, `useIndexerRef()`, `useActiveCollection()`, deep-link parser
  - `src/hooks/useUrlState.ts`
  - `src/hooks/useApiClient.ts` + `src/utils/problemDetails.ts` (general API client used by indexer-host's defense-in-depth `GET /document-sets/{id}` check; later slices reuse)
  - Plug `<IndexerHost>` into `<AppShell>`'s main canvas; pass `apiBaseUrl`, `getAccessToken`, `appInsights`, `initialTheme`, `initialState`, `onEvent`
  - Wire all 5 `IndexerEvent` types (even no-op for `collection/list-changed`)
  - Auth-expired remount via `remountKey` increment
  - Tests: event router (each event type → reducer assertion), URL state push/parse, axe over indexer-loaded shell + Suspense fallback
  - E2E: deep-link to `/c/<known-id>` → indexer mounts at that collection; click another collection in indexer → URL updates; back-button restores
- **Estimated LoC:** ~1,500

## Slice 3: Chat panel + SSE streaming

- **Spec sections:** REQUIREMENTS.md §4.1–4.7, §4.9 (model picker)
- **User capability:** *"User opens the chat panel in the active collection, asks a question, sees the answer stream in token-by-token, and can clear the conversation. Switching collections away and back restores the conversation. Model picker persists within session."*
- **Scope:**
  - Add deps: `@tanstack/react-query`, `@phosphor-icons/react`
  - Wrap app in `<QueryClientProvider>`
  - `src/components/Panel/`, `src/components/IconButton/`, `src/components/LoadingSpinner/`, `src/components/Pill/`, `src/components/Splitter/` (all the shared UI primitives chat needs; viewer reuses next slice)
  - `src/features/chat/`: `<ChatPanel>`, composer, message list (citation markers stubbed — real impl in slice 4), conversation lifecycle hooks (`useConversation`, `useChatHistory`), `useSseChat()`, status row simulator with fallback cycle, model picker dropdown, "Clear" confirm dialog
  - `src/utils/parseSse.ts`
  - `src/hooks/useAbortable.ts`, `src/hooks/useDebouncedValue.ts`
  - Plug `<ChatPanel>` into `<AppShell>` left panel slot; wire splitter persistence
  - Tests: conversation resolution (existing → load history; none → lazy create on send), SSE happy path (mock fetch with ReadableStream of token + error events), abort cancels cleanly, status row phase transitions, model picker persists within session, axe over chat panel in every state (empty, history-loaded, streaming, error, model dropdown open, clear-confirm dialog open)
  - E2E: open chat → send a message → tokens stream → reach completion → clear → conversation resets; switch collections → chat re-scopes
- **Estimated LoC:** ~3,500

## Slice 4: Citations + Document viewer (PDFs)

- **Spec sections:** REQUIREMENTS.md §4.8 (source list), §5 (citations + viewer for PDFs)
- **User capability:** *"User clicks an inline citation in a chat answer or an item in the source list and sees the source PDF page open with the cited passage highlighted. Page navigation works. Citations missing coordinates render as 'Unverified'. Highlights covering > 25% of page height fall back to 'Couldn't locate'."*
- **Scope:**
  - Add deps: `pdfjs-dist` (`--save-exact`), `@phosphor-icons/react/dist/ssr` if needed for SSR-safety (Phosphor handles this)
  - `src/components/Tooltip/`
  - `src/features/citations/`: `<CitationMarker>` (replaces stub from slice 3), `<SourceList>`, `useCitationClick()`
  - `src/features/viewer/`: `<DocumentViewer>` panel, pdf.js loader configured with custom fetch (auth header), three-layer rendering (canvas + text layer + highlight overlay), page navigation (numeric input + prev/next + PageUp/Down), citation highlight overlay using `driftGuard`, "Locating citation" banner, "Couldn't locate" fallback
  - `src/utils/bytesToBlobUrl.ts` (also used by image-viewer slice)
  - Replace chat's stubbed citation markers with real `<CitationMarker>`
  - Wire `<DocumentViewer>` into `<AppShell>` right panel slot; wire splitter persistence; wire opening from chat (citation click, source-list click) and from indexer (`document/selected` event)
  - Citation click also calls `indexerRef.current?.revealDocument(documentId)` per REQUIREMENTS.md §2.6
  - Tests: pdf.js mock + render, citation rect overlay positioning at multiple render scales, drift guard at exactly 25% / 24.9% / 25.1% page-height fractions, missing-coords audit (`{x:0,y:0,w:0,h:0}` → strike-through), source-list group/dedupe, axe over viewer in loading/rendered/drift-guard-fired/no-highlight states
  - E2E: ask a question that returns a citation → click `[1]` → viewer opens at the cited page → highlight visible → close viewer → click source-list item → viewer reopens
- **Estimated LoC:** ~3,500

## Slice 5: Image viewer + read-only behavior + responsive layout polish

- **Spec sections:** REQUIREMENTS.md §5.5 (image rendering), §6.1 (responsive), §4.6 / read-only behavior (REQUIREMENTS.md acceptance Read-only)
- **User capability:** *"User opens an image document and sees it rendered with citation overlay. The app works on tablet (panels stack/overlay correctly) and mobile (full-screen panels with backdrop). Shared collections are appropriately read-only — no upload/mutate UI anywhere; chat input still works."*
- **Scope:**
  - `src/features/viewer/`: image renderer using blob-URL pattern (auth-fetched), citation overlay reuses the highlight component from slice 4, "Preview not available" fallback for Word/spreadsheet (deferred to v2 — show download button)
  - `<AppShell>` and panels: responsive breakpoints (≥1201 desktop side-by-side, 768–1200 fixed chat / overlay viewer, <768 stack with backdrop), `min-height: 100dvh` for full-height layouts
  - Read-only handling: chat input enabled but `accessRole === 'Shared'` is logged in telemetry (`trackEvent('shared-collection-chat')`); no upload/mutate UI exists in the consuming app already (we never built any), but verify the indexer's behavior end-to-end — and document the verification in the slice PR
  - Final accessibility pass: skip-to-main link in `<AppShell>`, `aria-live` on every status banner, keyboard nav verified across all panels, focus traps validated
  - Performance pass: lazy-load `pdfjs-dist` worker, verify `splitChunks` produces a separate vendor chunk, run a production build and confirm no `console.*` survives Terser
  - Tests: image render + overlay, breakpoint behavior at 767/768/1200/1201, read-only e2e (mock a Shared collection or use a real one), axe at each breakpoint, full Playwright sweep across Chrome / Edge / Safari (`web-browser-support.md`)
  - E2E: full critical-path flow (sign in → indexer mounts → click collection → ask question → click citation → see highlight → reopen on mobile breakpoint → still works)
- **Estimated LoC:** ~2,500

---

## Cross-cutting requirements present in every slice

These are **not** standalone slices — each one is enforced inside the touching slice's PR:

- **Tests:** unit + accessibility (jest-axe across each meaningfully different rendered state), E2E for the critical path the slice unlocks. 80% coverage hard floor.
- **No magic numbers:** every limit / timeout / threshold traces to a rule file, REQUIREMENTS.md, or `/shared/types/`.
- **Error handling:** every async surface has explicit handling; user-friendly messages, no stack traces; `appInsights.trackException` for everything caught.
- **Theming:** all UI honors `[data-theme]`; uses CSS variables only; no hardcoded colors.
- **PII discipline:** never log message content, AI responses, document text, or user identifiers (UPN/email). `appInsights` properties limited to `operationId`, `homeAccountId` (pseudonymous), and non-content metadata.

---

## What's deferred (NOT in any slice — see REQUIREMENTS.md §10)

- Follow-up question suggestions
- "Quick" model option
- Word / spreadsheet inline preview (v1 ships download button)
- Multi-rectangle highlights for multi-line quotes
- Conversation list UI
- Doc-type pills / section headings in source list
- Theme override props sent to indexer
- Persisting model picker selection across sessions
- Mobile platform support beyond what indexer covers
- A toast/notification system (inline error states only in v1)

If any of these come back into scope, they're a new slice — they do not get retrofitted into one of the five above.

---

## Mapping: spec sections → slices

| Spec | Slice | Notes |
|---|---|---|
| §1 Overview | — | descriptive |
| §2.1 Stack & versions | 1, 2 | foundational deps in slice 1, MF deps in slice 2 |
| §2.2 Webpack host config | 2 | |
| §2.3 Loading the indexer | 2 | |
| §2.4 Props passed | 2 | |
| §2.5 Event handling | 2 | (each event type — handler tested) |
| §2.6 Imperative ref usage | 2 (skeleton), 4 (citation click → revealDocument) | |
| §2.7 Deep linking | 2 | |
| §2.8 Layout shell | 1 (skeleton), 5 (responsive polish) | |
| §3 Auth | 1 | |
| §4.1 Conversation model | 3 | |
| §4.2 Chat panel UI | 3 | |
| §4.3 Chat input | 3 | |
| §4.4 SSE client | 3 | |
| §4.5 Status row | 3 | |
| §4.6 Follow-ups | — | deferred |
| §4.7 Chat history | 3 | |
| §4.8 Source list | 4 | (real source list with citation linkage) |
| §4.9 Model picker | 3 | |
| §5.1 Inline citations | 4 | (slice 3 stubs them) |
| §5.2 Citation audit | 4 | |
| §5.3 Where viewer opens | 4, 5 | (PDFs in 4, indexer document/selected in 4, image opens in 5) |
| §5.4 PDF rendering | 4 | |
| §5.5 Render strategy | 4 (PDF), 5 (image), — (Word/sheet — deferred) |
| §5.6 Citation highlighting | 4 | |
| §5.7 Document header | 4 | |
| §5.8 Page navigation | 4 | |
| §6.1 Responsive layout | 5 (polish; earlier slices build with this in mind) | |
| §6.2 Theming | 1 | |
| §6.3 Persistence | 1, 3, 4 | |
| §6.4 Keyboard | per slice | |
| §6.5 Accessibility | per slice + 5 final pass | |
| §6.6 Performance | per slice + 5 final pass | |
| §6.7 Errors / empty states | per slice | |
| §7 App Insights | 1 | |
| §8 Testing | per slice | |
| §9 Acceptance | end of slice 5 — final E2E sweep | |
| §10 Deferred | — | |

Every numbered section is mapped. Deferred items are explicitly out of scope.
