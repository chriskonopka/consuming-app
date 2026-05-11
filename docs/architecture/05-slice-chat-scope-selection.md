# Slice 5 — Chat scope (selection-narrowed retrieval)

> **Capability:** _"User picks one or more documents (and, when the indexer supports it, folders) in the indexer; the next chat send asks the API to narrow retrieval to that selection. A scope-indicator strip above the chat body lists what's currently scoped, each entry removable, with a 'Clear all' affordance. Empty selection → whole-DocumentSet retrieval (legacy behavior, no regression)."_

**Drivers**

- 2026-05-09 FE team handoff (`/Users/chris/Downloads/2026-05-09-fe-team-status.md` §"Open issues for the FE team to investigate" #2) — chat does not honor the user's document selection.
- 2026-05-11 API team response — `SendMessageRequest` now accepts optional `documentIds: string[]` and `folderIds: string[]` (max 64 per array). Server semantics: empty/absent → whole set; non-empty → OR-of-whitelists, ANDed with the document set.

**Spec references**

- REQUIREMENTS.md §4 (chat) — extended implicitly; selection-narrowing was not enumerated in v1.0 of the spec.
- `../reusable-indexer/frontend-api-contract.md` — `POST /document-sets/{setId}/conversations/{conversationId}/messages` body.

---

## Layers changed

| Layer                                            | Files                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared types                                     | `shared/types/api-dtos.ts` — `SendMessageRequest` gains optional `documentIds?: string[]` and `folderIds?: string[]`. New `SEND_MESSAGE_SELECTION_MAX = 64` constant for client-side enforcement matching the server boundary.                                                                                        |
| New feature                                      | `src/features/chat-scope/` — `chatScopeReducer.ts` (state + actions), `ChatScopeContext.tsx` (`<ChatScopeProvider>` + `useChatScope()`), `ScopeIndicator.tsx` (chip UI + SCSS module), barrel `index.ts`. Colocated tests for all three plus axe sweep on the populated indicator.                                    |
| App shell                                        | `src/app-shell/AppShell.tsx` — `<ChatScopeProvider>` wraps `<ViewerProvider>` so both the indexer-host bridge and the chat panel see the same context.                                                                                                                                                                |
| Indexer host                                     | `src/features/indexer-host/IndexerHost.tsx` — `onDocumentSelected` now also toggles the doc in chat scope (transitional bridge — see "Open work for the indexer team" below). `onCollectionActivated` calls `chatScope.resetForCollectionChange()` so scope never leaks across DocumentSets.                          |
| Chat panel                                       | `src/features/chat/ChatPanel.tsx` — renders `<ScopeIndicator>` above the message list; reads `chatScope.state` and passes it into `useSseChat` as `selection`. New error notice copy for `onSelectionTooLarge`.                                                                                                       |
| Chat SSE client                                  | `src/features/chat/useSseChat.ts` — accepts `selection?: { documentIds, folderIds }`; threads through a ref so live changes between renders are reflected on the next send. Adds `documentIds` / `folderIds` to the POST body only when non-empty. Pre-flight cap check calls the new `onSelectionTooLarge` callback. |
| Viewer                                           | `src/features/viewer/index.ts` — exports `useDocumentMetadata` (used by `ScopeIndicator` for chip labels).                                                                                                                                                                                                            |
| Indexer host fix (separate concern, same branch) | `src/features/indexer-host/IndexerHost.tsx` — ports `main@88e3c38`'s `startTransition` wrap around `onCollectionActivated`'s reducer dispatch + URL push so the URL-reconciliation effect can't fire a spurious `selectCollection(null)` between them. Regression test in `IndexerHost.test.tsx`.                     |

## /shared/ additions

- `shared/types/api-dtos.ts`
  - `SendMessageRequest.documentIds?: string[]`
  - `SendMessageRequest.folderIds?: string[]`
  - `SEND_MESSAGE_SELECTION_MAX = 64`

Re-exported automatically through `shared/types/index.ts`.

## State management

`ChatScopeState = { documentIds: string[]; folderIds: string[] }` — lives in a Context + reducer per `web-state-management.md`. Action variants are `UPPER_SNAKE_CASE` discriminated unions; the reducer has an exhaustive switch with no `default`.

- `TOGGLE_DOCUMENT` / `TOGGLE_FOLDER` — transitional bridge entry points for the indexer's existing `document/selected` event. Adds with bounds-check (no-ops past `SEND_MESSAGE_SELECTION_MAX`); removes when present.
- `REMOVE_DOCUMENT` / `REMOVE_FOLDER` — chip × buttons in `ScopeIndicator`.
- `SET_SELECTION` — future entry point for the indexer's planned `selection/changed` event. Dedupes and truncates incoming arrays to `SEND_MESSAGE_SELECTION_MAX`.
- `CLEAR` — "Clear all" button.
- `RESET_FOR_COLLECTION_CHANGE` — fired on `collection/activated` so scope never crosses DocumentSets.

The reducer returns the same state identity on no-op transitions, so React skips re-renders that don't change visible state.

## UI

`<ScopeIndicator>` renders **nothing** when both arrays are empty (zero visual cost in the unscoped case). When non-empty, it sits between the chat header and the message list as a chip rack with a single "Clear all" trailing button.

- Document chips fetch their `fileName` via the shared `useDocumentMetadata` query (TanStack Query, 5-minute staleTime — cache hit when the viewer has already loaded the doc). Falls back to "Document" before metadata resolves.
- Folder chips render as `Folder N` placeholders until the indexer's planned `selection/changed` event ships `folderName` in its payload (see handoff doc).
- Chip remove buttons carry `aria-label="Remove <label> from chat scope"` for screen readers.

Styling uses `color-mix()` against `--accent-interactive` for the strip background (per `web-styling.md` — no hardcoded `rgba`). The container is a `<section>` with `aria-label="Chat scope"`.

## Acceptance

| #   | Behavior                                                                                                    | Covered by                                                                                                                                                 |
| --- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Clicking a ready document in the indexer toggles it in chat scope (transitional bridge). Viewer also opens. | `IndexerHost.test.tsx` — _toggles the doc in chat scope when document/selected fires_ + _opens the viewer at page 1 when document/selected fires_          |
| 2   | Switching collections clears stale scope.                                                                   | `IndexerHost.test.tsx` — _resets chat scope when the active collection changes_                                                                            |
| 3   | Empty scope → request body omits `documentIds` / `folderIds`.                                               | `useSseChat.test.tsx` — _forwards selection arrays in the messages body and omits when empty_                                                              |
| 4   | Non-empty scope → request body carries the arrays.                                                          | same test as #3                                                                                                                                            |
| 5   | Per-array cap of 64 enforced before fetch.                                                                  | `useSseChat.test.tsx` — _rejects sends when selection arrays exceed the per-array cap_; `chatScopeReducer.test.ts` — _ignores adds past the per-array cap_ |
| 6   | Chip × buttons remove the right id; "Clear all" empties the strip.                                          | `ScopeIndicator.test.tsx`                                                                                                                                  |
| 7   | No axe violations on the populated indicator.                                                               | `ScopeIndicator.test.tsx` — _has no axe violations in the populated state_                                                                                 |
| 8   | Indexer host no longer bounces on collection click (ported `main@88e3c38`).                                 | `IndexerHost.test.tsx` — _does not bounce back to none after activating a collection_                                                                      |

## Open work for the indexer team

The consumer side of this slice is complete. To replace the transitional bridge (clicking a doc both opens the viewer AND toggles it in chat scope) with a clean separation of concerns, the indexer needs to:

1. Add a multi-select affordance in its file list (checkboxes or a selection mode toggle) and a folder-select affordance in its folder tree.
2. Track the user's current chat-scope selection internally.
3. Emit a new `IndexerEvent` variant whenever that selection changes.

The exact contract proposal is in **[docs/architecture/indexer-handoff-selection-event.md](./indexer-handoff-selection-event.md)** — hand that file to the indexer team. Once the indexer ships the new event:

- Add a case to `eventRouter.ts` for the new variant.
- In `IndexerHost.tsx`, call `chatScope.setSelection(documentIds, folderIds)` from the new handler.
- Remove the `chatScope.toggleDocument(...)` line from `onDocumentSelected` — opening the viewer should once again be its only job.
- If the event payload carries `fileName` and `folderName`, plumb them into `ScopeIndicator` so folder chips show real names.

Until the indexer ships the event, the bridge keeps the user-facing capability working: a single click both opens the viewer and adds the doc to chat scope; a second click on the same doc removes it; collection switch clears scope.
