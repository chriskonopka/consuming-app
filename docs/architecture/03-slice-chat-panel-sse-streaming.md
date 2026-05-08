# Slice 3 — Chat panel + SSE streaming

> **Capability:** *"User opens the chat panel in the active collection, asks a question, sees the answer stream in token-by-token, and can clear the conversation. Switching collections away and back restores the conversation."*

**Spec sections:** REQUIREMENTS.md §4.1–4.7. Model picker (§4.9) hardcoded to `llmProvider: 'Claude'`; follow-up suggestions (§4.6) deferred per slice plan.

## Layers changed

| Layer | Files |
|---|---|
| Deps | `package.json` — added `@tanstack/react-query@^5.100.9` and `@phosphor-icons/react@^2.1.10` (versions match indexer's `package.json`) |
| Provider tree | `src/bootstrap.tsx` — wrapped app in `<QueryClientProvider>` with retry: 1, refetchOnWindowFocus: false |
| Shared UI primitives | `src/components/IconButton/`, `src/components/LoadingSpinner/`, `src/components/Panel/`, `src/components/Splitter/` — placeholders replaced with implementations + `.module.scss` + `.test.tsx` |
| Hooks (real impl) | `src/hooks/useAbortable.ts`, `src/hooks/useDebouncedValue.ts` — replaced placeholders + colocated tests |
| Utils | `src/utils/parseSse.ts` — implemented (handles `\r?\n\r?\n` boundaries, multi-line `data:`, comment lines, abort) + colocated test |
| Chat feature | `src/features/chat/` — full module: `ChatPanel`, `Composer`, `MessageList`, `CitationStub`, `StatusRow`, `ClearConfirmDialog`, `useChatSession`, `useConversation`, `useChatHistory`, `useSseChat`, `useStatusRow`, `chatReducer`, `queryKeys`, `statusPhrases` |
| App shell | `src/app-shell/AppShell.tsx` — added chat-toggle `<IconButton>` in header, wired `<ChatPanel>` as child of `<IndexerHost>` (so it can read `useActiveCollection`), wired splitter persistence via `SET_CHAT_PANEL_WIDTH` |
| Test infra | `src/setupTests.ts` — added polyfills for `ReadableStream`/`WritableStream`/`TransformStream` (Node `stream/web`) and `PointerEvent` shim. `src/app-shell/AppShell.test.tsx` — wrapped with `<QueryClientProvider>` |
| E2E | `e2e/app.spec.ts` — added "Slice 3 — chat panel + SSE streaming" describe block (panel toggle, send-body shape, disabled-when-no-collection) |
| Coverage | `jest.config.ts` — removed slice-3 placeholder excludes |

## /shared/ additions

No new entries in `/shared/types/` — the slice consumed existing `chat.ts`, `api-dtos.ts`, `citation.ts`, `layout.ts`. Inventory entries previously marked "scaffolded — implementation lands in slice 3" are now **implemented**:

| Entry | Status |
|---|---|
| `useApiClient` (was scaffolded slice 2) | Reused — no changes |
| `useAbortable` | Implemented |
| `useDebouncedValue` | Implemented |
| `parseSse` | Implemented |
| `<IconButton>`, `<LoadingSpinner>`, `<Panel>`, `<Splitter>` | Implemented |

`<Pill>` and `<Tooltip>` remain scaffolded — their consumers ship in slice 4 (citations + viewer).

The chat feature's internal hooks (`useChatSession`, `useConversation`, `useChatHistory`, `useSseChat`, `useStatusRow`) live inside `src/features/chat/` per `web-file-structure.md` ("feature-internal hooks live in the feature folder, not `src/hooks/`").

## Architecture-doc updates

None. The slice landed inside the contract surface locked in `module-boundaries.md` and `data-model.md`. The `chatPanel.widthPx` resize through `<Splitter>` uses the existing `LayoutAction.SET_CHAT_PANEL_WIDTH` from slice 1.

## Decisions / tradeoffs not visible from the diff

1. **Status-row tick rate (`TICK_MS = 250`)** is a polling interval, not a user-visible threshold. The user-visible thresholds (500/1200/2000ms phase advancement, 1500ms fallback after, 2500ms fallback rotation) come verbatim from REQUIREMENTS.md §4.5. The 250ms tick is an implementation detail that determines reactivity within those thresholds.

2. **Splitter `KEYBOARD_STEP_PX = 10`** and Composer `MAX_TEXTAREA_HEIGHT_PX = 240` are UX defaults. Spec doesn't pin them; they are reasonable starting values that can be tuned without spec churn.

3. **Streaming bubble user-side is empty.** During streaming we render a user `<li>` with no content (placeholder for the optimistic user message). The user's actual question is visible because the textarea was just typed in; full optimistic-user-bubble rendering is deferred to a follow-up where the message text is captured into `StreamingState.userMessageContent` (currently `userMessageId` only stores the optimistic id). This was the smallest surface that ships the capability — the streaming assistant answer is what carries the perceived value.

4. **Citation marker is a stub button** (`CitationStub`). It renders the same DOM shape (`<button>`, tooltip, strike-through for missing coords) so that slice 4's `<CitationMarker>` swaps in without changing `MessageList`. The strike-through "Unverified — coordinates missing" rendering already lives here so the user-visible audit (REQUIREMENTS.md §5.2) appears the moment streaming works, not only when the viewer ships.

5. **Mid-stream error event terminates the stream and shows a non-blocking notice** but does not retry. Spec §4.4 explicitly forbids retry. The composer text is preserved in the reducer (the user can re-send). Pre-stream `ProblemDetails.detail` is rendered verbatim per api-contracts.md §3.

6. **`useChatHistory` invalidates after every assistant response.** TanStack Query refetches and renders the server-authoritative version, replacing the streamed content. If the server somehow doesn't have the message (network race), the streaming bubble vanishes — that's an acceptable failure mode and matches the data-model.md "messages are server-authoritative" invariant.

7. **`X-Operation-Id` is captured by `useApiClient` automatically.** No extra wiring needed in chat — the SSE call uses `api.raw()` which still runs `trackDependency`.

8. **Token uniformity preserved.** `useSseChat` uses the same `useApiClient` (and through it, the same `useAccessToken`) that the indexer already uses. No second MSAL instance, no second scope.

## Review outcomes

- **`/code-review`** — 5 findings, all addressed:
  - High: splitter wasn't actually wired into AppShell — fixed by adding `onResize` prop to `<ChatPanel>` and rendering `<Splitter>` on the panel's right edge (hidden on mobile).
  - Medium: dead `if/else` in `clearMutation.onError`, unused `__testing` / `__chatPanelTesting` exports, and a `ChatCircleText` icon used as the close button — all corrected.
  - Low (informational): `MessageList` list items don't pass callback props, so the memo+useCallback rule for list items doesn't apply.
- **`/security-review`** — 0 findings. PASS.

## Quality gates

| Gate | Result |
|---|---|
| `npm run lint` | clean |
| `npx tsc --noEmit` | clean |
| `npm run test:coverage` | 237 tests pass; 93.16% lines / 83.84% branches / 88.55% funcs / 95.07% statements (80% threshold) |
| `npm run test:e2e --project=chromium` | 16/16 pass (including 3 new slice-3 specs) |

Edge browser is unavailable on this machine (`Microsoft Edge.app not found`); chromium covers the matrix's primary browser. CI runs both per `playwright.config.ts`.

## Open follow-ups

- **Optimistic user bubble content.** `StreamingState.userMessageId` exists but the user message text isn't stored — the streaming user-li is a blank placeholder. Real content shows up after history refetches. A future tweak can store `userMessageContent` for a continuous user-visible thread.
- **Status-row aria-live update cadence.** Screen readers may announce phase changes more often than ideal as the simulator advances. Tune by adding `aria-live` debouncing if user-testing surfaces it.
- **TanStack Query DevTools** are not wired (deferred — opens a security/bundle-size door that the slice doesn't need). Add when debugging warrants it, gated on `process.env.NODE_ENV !== 'production'`.
- **Splitter pointer drag tests** rely on a setupTests `PointerEvent` shim because jsdom 20 doesn't implement it. When jsdom upgrades, the shim block in `src/setupTests.ts` can be removed.
- **Edge browser** isn't installed in this environment — CI will run it via `npx playwright install msedge` per the existing setup.
