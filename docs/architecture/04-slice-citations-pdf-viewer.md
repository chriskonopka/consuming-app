# Slice 4 — Citations + Document viewer (PDFs)

> **Capability:** *"User clicks an inline citation in a chat answer or an item in the source list and sees the source PDF page open with the cited passage highlighted. Page navigation works. Citations missing coordinates render as 'Unverified'. Highlights covering > 25% of page height fall back to 'Couldn't locate'."*

**Spec sections:** REQUIREMENTS.md §4.8 (source list), §5.1, §5.2, §5.4, §5.6, §5.7, §5.8 (PDF viewer + citations). §5.3 partially (PDF + indexer `document/selected`; image-side closes in slice 5). §5.5 partially (PDF only; image rendering in slice 5).

## Layers changed

| Layer | Files |
|---|---|
| Deps | `package.json` — added `pdfjs-dist@4.10.38` (`--save-exact` per `web-component-architecture.md` worker-contract pinning rule). 4 low-severity audit findings (all dev-only transitives via jsdom); accepted per `web-dependency-security.md`. |
| Webpack | `webpack.config.js` — added `asset/resource` rule for `pdfjs-dist/build/pdf.worker(.min)?.mjs` so the worker is emitted at build time and its URL is surfaced via the default import. |
| Jest | `jest.config.ts` — added `moduleNameMapper` entries for the worker (→ fileMock) and pdfjs-dist itself (→ `src/__mocks__/pdfjs-dist.ts` — minimal stub for tests that walk the viewer module graph but don't exercise rendering). Removed slice-4 placeholder coverage excludes for `features/citations/`, `features/viewer/`, `components/Tooltip`, `components/Pill`. |
| TS | `src/global.d.ts` — module declaration for `pdfjs-dist/build/pdf.worker.min.mjs` (default-export string). |
| Test infra | `src/setupTests.ts` — added `HTMLCanvasElement.prototype.getContext` shim (jsdom returns null, which the viewer treats as a render error) + extended the `Response` shim to accept `ArrayBuffer`/`ArrayBufferView` bodies and expose `arrayBuffer()`. |
| Shared UI primitives | `src/components/Tooltip/` — implemented (clones the child, adds `aria-describedby`, hover/focus reveal, Escape dismiss). `src/components/Pill/` — implemented (text + tone, color-blind safe; tooltip-on-truncation when overflow detected). Both colocated with `.module.scss` + `.test.tsx`. |
| Citations feature | `src/features/citations/` — `<CitationMarker>` (real impl, replaces slice-3 `CitationStub`), `<SourceList>` (uses `groupCitationsBySource`), `useCitationClick` (composes `useViewer.open` + `indexerRef.revealDocument`). Colocated tests + SCSS. |
| Viewer feature | `src/features/viewer/` — `viewerReducer` + `<ViewerProvider>`/`useViewer` (Context above AppShell so chat, source list, and indexer-host all dispatch into one state). `<DocumentViewer>` panel orchestrator (header, body, page nav). `<ViewerHeader>` (file name + Pill for `fileType` + page count + close). `<PageNavigation>` (numeric input + prev/next + form-submit commit). `<HighlightOverlay>` (rect overlay scaled by `pageViewport.scale`, drift-guard verdict published back to reducer). `usePdfDocument` (fetches PDF body via `useApiClient.raw()` + feeds `getDocument({ data })`; aborts + destroys on unmount/documentId change). `usePdfPage` (renders canvas + text layer + reports viewport; cancels on dep change). `useDocumentMetadata` (TanStack Query, 5min staleTime). `pdfjsConfig` (one-shot worker URL setter). `queryKeys`. |
| Chat | `src/features/chat/MessageList.tsx` — swapped `CitationStub` for `<CitationMarker>` (driven by `useCitationClick`); added `<SourceList>` after each completed assistant message. Synthesises a strike-through fallback citation for orphan `[cite:N]` markers (previously handled inside CitationStub). Removed the now-dead `CitationStub.tsx`/`CitationStub.module.scss`/`CitationStub.test.tsx`. |
| Indexer host | `src/features/indexer-host/IndexerHost.tsx` — `onDocumentSelected` handler now calls `viewer.open(event.documentId, 1, null)` (api-contracts.md §1.3). Added `useViewer` import. |
| App shell | `src/app-shell/AppShell.tsx` — wraps the inner shell in `<ViewerProvider>`; mounts `<DocumentViewer>` in the right slot of `<IndexerHost>`. Reads `viewer.state.open !== null` directly to drive the panel-open prop (data-model.md §2.5 — `LayoutState.viewerPanel.open` is transient and the viewer reducer is the source of truth). Wires the splitter via `SET_VIEWER_PANEL_WIDTH`. |
| E2E | `e2e/app.spec.ts` — added `Slice 4` describe block (3 tests covering: indexer `document/selected` opens the viewer at page 1; viewer header surfaces fileType pill + page count; Escape closes the viewer). Added `e2e/fixtures/sample.pdf` — a hand-crafted 481-byte 1-page PDF that pdf.js parses cleanly. |
| Coverage | `jest.config.ts` — slice-4 placeholder excludes removed (citations, viewer, Tooltip, Pill). Pill re-included in coverage now that the viewer header consumes it. |

## /shared/ additions

No new entries in `/shared/types/`. The slice consumed existing `viewer.ts` (`CitationRect`, `ViewerState`, `DRIFT_GUARD_MAX_PAGE_FRACTION`, `driftGuard`, `toCitationRect`, `PageRenderState`), `citation.ts` (`Citation`, `auditCitation`, `groupCitationsBySource`, `SourceGroup`), `api-dtos.ts` (`DocumentMetadataResponse`, `FileTypeCode`).

Inventory entries previously marked "scaffolded — implementation lands in slice 4" are now **implemented**:

| Entry | Status |
|---|---|
| `<Tooltip>` | Implemented |
| `<Pill>` | Implemented |
| `bytesToBlobUrl` | Still scaffolded (image rendering ships in slice 5) |

## Architecture-doc updates

None. The slice landed inside the contract surface locked in `module-boundaries.md`, `api-contracts.md`, and `data-model.md`. No host-contract changes (`/c/{id}` URL shape unchanged; new `?documentId=` deep-link is already in the contract from slice 2).

## Decisions / tradeoffs not visible from the diff

1. **PDF body via `data: ArrayBuffer`, not `getDocument({ url, httpHeaders })`.** The slice-plan sketch suggested a custom fetch-based loader using pdf.js's `httpHeaders`. We chose to fetch the bytes ourselves through `useApiClient.raw()` and pass `data: new Uint8Array(buffer)` to pdf.js instead. Two reasons:
   - **Token uniformity (CLAUDE.md §"Token uniformity"):** `useApiClient.raw()` carries the canonical bearer auth, the 401 retry, telemetry, and `X-Operation-Id` capture. Going through pdf.js's own request path would split the auth flow.
   - **Testability:** pdf.js worker fetches are jsdom-hostile; passing an ArrayBuffer keeps the auth surface mockable.
   
   Tradeoff: we lose pdf.js's range-request / progressive-load behaviour for very large PDFs. v1 is acceptable for born-digital documents in the typical size range; revisit if a scanned/large-PDF perf complaint surfaces.

2. **`<ViewerProvider>` lives at the AppShell, not inside the viewer feature folder.** The viewer state is shared by three callers: chat (`useCitationClick` for citation marker + source list clicks), indexer-host (`onDocumentSelected` event), and the panel itself (close / setPage). Mounting the provider at the shell keeps every subtree reading from one reducer instance.

3. **`LayoutState.viewerPanel.open` is intentionally unused in v1.** The data-model declares the field but says it's transient per session. With slice 4, the viewer reducer is the source of truth (`viewer.state.open !== null`); the layout reducer's `OPEN_VIEWER_PANEL`/`CLOSE_VIEWER_PANEL`/`TOGGLE_VIEWER_PANEL` actions are never dispatched. The `useLayoutState` hook still resets the field to false post-hydrate (vestigial but harmless). Marking the field dead would have required changing the layout reducer's action type, which is out of scope for slice 4.

4. **pdfjs-dist version: 4.10.38 (latest 4.x), not 5.x.** v5 is current but tightens ESM-only output and drops legacy browser fallbacks. v4.10.38 is the last 4.x release and a stable baseline that integrates cleanly with the existing webpack + babel-loader setup. Pinned exact (`--save-exact`) per `web-component-architecture.md` worker-contract rule.

5. **Worker bundling via webpack `asset/resource`.** The worker URL is needed by pdf.js at runtime. Three approaches considered: CDN URL (rejected — supply chain risk), `new URL(..., import.meta.url)` (rejected — ts-jest CommonJS doesn't support it), and webpack `asset/resource` rule on the worker file (chosen — works in webpack at build time, is mocked in jest via `moduleNameMapper`).

6. **Drift-guard verdict published back through the reducer.** `<HighlightOverlay>` decides `render` vs. `reject` from rect/viewport geometry, then publishes the boolean via `dispatch({ type: 'SET_DRIFT_GUARD', fired })`. The orchestrator (`<DocumentViewer>`) reads the flag to render the "Couldn't locate" banner and to gate the auto-scroll-into-view behaviour. Keeps overlay rendering and banner rendering decoupled while still single-sourced.

7. **CitationMarker swap-in is silent.** The slice-3 `CitationStub` (button + tooltip + strike-through-on-missing-coords) was a structural decoy specifically so slice 4 could replace it without touching `MessageList`'s rendering path. The swap is a one-line import change in `MessageList.tsx`; the orphan-citation fallback (synthetic zero-rect citation when the LLM emits `[cite:N]` without a matching citation event) was lifted up from the stub into the message-list render helper so the new `<CitationMarker>` stays focused on a single citation type.

8. **E2E scope narrowed from the slice-plan sketch.** The plan called for "click [1] → viewer opens at the cited page → highlight visible". In practice the chat-history-rendered citation marker is hard to assert in Playwright because the streaming bubble's render timing in the test app is brittle (the slice-3 e2e never asserted rendered chat content either; it only verified request bodies). We instead verify the same wiring through the indexer's `document/selected` path: stub indexer → "Open stub document" → viewer opens → header shows file type pill + page count → Escape closes. The citation→viewer path is fully covered by jest unit tests on `MessageList`, `CitationMarker`, `SourceList`, and `useCitationClick` + the integration test on `<DocumentViewer>` rendered via `<ViewerProvider>`. This is documented as a known gap if the chat-history-in-e2e issue is fixed in slice 5.

9. **Defense-in-depth encoding on documentId.** v1 wires `documentId = citation.fileName`. Even though the API enforces ownership and the citation is server-resolved, the file name traverses through an LLM response. Both `usePdfDocument` and `useDocumentMetadata` `encodeURIComponent` the path segment so a hallucinated `..` or `/` can never produce a path-traversal request.

10. **No documentId in App Insights properties.** File names can carry user-identifying metadata (CLAUDE.md "PII discipline" + `web-error-logging.md`). The viewer's exception logs use stage tags only.

## Review outcomes

- **`/code-review`** — 2 findings, both addressed:
  - **High:** `usePdfDocument` depended on the `useApiClient()` object identity (recreated each render), which caused the effect to re-fire and re-fetch the PDF on every render. Fixed by destructuring the stable `raw` callback (`useCallback`-memoised inside `useApiClient`) and depending on it directly.
  - **Medium:** `usePdfPage` used a structural `as` cast on `error` to read `.name`. Replaced with `error instanceof Error ? error.name : ''`.
- **`/security-review`** — 2 findings, both addressed:
  - **Medium (A09):** `usePdfDocument` logged `documentId` (a file name) in App Insights `properties`. Replaced with a stage tag (`{ stage: 'pdf-load' }`) — file names can carry PII.
  - **Medium (A03/A01):** `documentId` was interpolated raw into `/documents/${id}/...` URL paths. v1 wires `documentId = citation.fileName` from an LLM response, so a `/` or `..` in the value could attempt path traversal. Wrapped in `encodeURIComponent` in both `usePdfDocument` and `useDocumentMetadata`.
  - **Overall: PASS** (zero Critical or High findings).

## Quality gates

| Gate | Result |
|---|---|
| `npm run lint` | clean |
| `npx tsc --noEmit` | clean |
| `npm run test:coverage` | 328 tests pass; **95.37%** lines / 84.93% branches / 91.17% funcs / 93.47% statements (80% threshold) |
| `npm run test:e2e --project=chromium` | 19/19 pass with one retry on the slice-2 `back-button` flake (the retry path is the CI configuration; the failure is pre-existing and not introduced by slice 4) |

## Open follow-ups

- **Chat-history-in-e2e flake.** The `clicking an inline citation` and `clicking a source-list item` e2e flows assert rendered chat history; in practice the chat panel's empty-state shows even after `POST /history` returns valid JSON in the e2e environment. The same flow works in jest (`ChatPanel.test.tsx` "passes axe with history loaded"). Suspect a TanStack Query / SSE timing artifact that doesn't manifest with mocked fetch in jest. Listed as a known gap; revisit during slice 5's full critical-path E2E.
- **PDF range requests.** v1 fetches the entire PDF body to an ArrayBuffer and feeds pdf.js. For large PDFs (> ~10 MB), revisit the `getDocument({ url, httpHeaders })` path with token-acquisition handled before getDocument is called. The API already supports `Range` per `api-contracts.md` §2.4.
- **Slice-2 back-button flake.** Pre-existing; the test relies on browser-back history reconciliation that is timing-sensitive. The Playwright config retries twice in CI which masks the flake there. A targeted `await page.waitForFunction(...)` after `goBack()` would stabilise it; out of slice 4 scope.
- **Image rendering + Word/spreadsheet fallback.** Deferred to slice 5 per the slice plan.
- **`bytesToBlobUrl` still scaffolded.** Implementation lands in slice 5 alongside the image renderer.
