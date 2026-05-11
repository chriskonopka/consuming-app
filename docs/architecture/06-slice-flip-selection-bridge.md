# Slice 6 — Flip the chat-scope bridge to event-driven

> **Capability:** _"The indexer's multi-select UI is now the authoritative source of chat-scope selection. The transitional `document/selected → toggleDocument` bridge is removed. Chat-scope chips render straight from the indexer's `selection/changed` event payload — no `useDocumentMetadata` round-trip — and show real folder names + paths."_

**Drivers**

- Indexer PR #3 (`3cf5603`) merged to `chriskonopka/reusable-indexer/main`. The new `selection/changed` event ships the richer payload we asked for in the slice-5 handoff doc: `documents: { documentId, fileName }[]` + `folders: { folderId, folderName, path }[]`.

**Spec references**

- `../reusable-indexer/shared/types/host-contract.ts` (the indexer's updated contract).
- [`05-slice-chat-scope-selection.md`](./05-slice-chat-scope-selection.md) — the consumer-side slice this one flips.

---

## Layers changed

| Layer                     | Files                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ambient declaration       | `src/types/mws_indexer.d.ts` — adds `SelectionDocument`, `SelectionFolder`, and the `selection/changed` variant on `IndexerEvent`. Tracks the indexer's locked surface.                                                                                                                                                                                        |
| Shared types              | `shared/types/indexer-host.ts` — re-exports `SelectionDocument` and `SelectionFolder` so feature modules use them via `@shared/types`.                                                                                                                                                                                                                         |
| Indexer-host event router | `src/features/indexer-host/eventRouter.ts` — new `onSelectionChanged` handler + exhaustive switch case.                                                                                                                                                                                                                                                        |
| Indexer-host wiring       | `src/features/indexer-host/IndexerHost.tsx` — `onDocumentSelected` no longer touches chat scope (clicks open the viewer, full stop). New `onSelectionChanged` handler calls `chatScope.setSelection(event.documents, event.folders)`.                                                                                                                          |
| Chat-scope state          | `src/features/chat-scope/chatScopeReducer.ts` — state shape is now `{ documents: SelectionDocument[]; folders: SelectionFolder[] }`. Drops `TOGGLE_DOCUMENT` / `TOGGLE_FOLDER` (no longer needed — indexer is authoritative). `SET_SELECTION` accepts the rich shape; dedupe-and-cap retained as defense-in-depth though the indexer already enforces the cap. |
| Chat-scope context        | `src/features/chat-scope/ChatScopeContext.tsx` — `setSelection` signature `(documents, folders)`. Drops the `toggleDocument` / `toggleFolder` action creators.                                                                                                                                                                                                 |
| Chat panel                | `src/features/chat/ChatPanel.tsx` — extracts id arrays from the rich state at the boundary with `useSseChat` (which still talks `documentIds`/`folderIds` to the API).                                                                                                                                                                                         |
| Scope indicator           | `src/features/chat-scope/ScopeIndicator.tsx` — renders straight from state. Drops the `useDocumentMetadata` per-chip lookup. Folder chips now show real `folderName` + `path` (as `title`).                                                                                                                                                                    |
| Viewer barrel             | `src/features/viewer/index.ts` — removes the `useDocumentMetadata` re-export (no longer needed externally).                                                                                                                                                                                                                                                    |
| E2E stub                  | `src/features/indexer-host/IndexerApp.e2eStub.tsx` — adds two trigger buttons (`Emit selection/changed (populated)` / `Emit selection/changed (cleared)`) so jest specs can drive the new code path without reaching into internals.                                                                                                                           |
| Tests                     | `chatScopeReducer.test.ts`, `ChatScopeContext.test.tsx`, `ScopeIndicator.test.tsx`, `IndexerHost.test.tsx` — rewritten / extended for the new payload shape and event flow. Transitional-bridge tests removed; replaced with `selection/changed` populate + clear cases plus a "document/selected does NOT auto-scope chat" guard.                             |

## Acceptance

| #   | Behavior                                                                                               | Covered by                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `selection/changed` populates chat scope with the indexer-supplied documents + folders + paths.        | `IndexerHost.test.tsx` — _mirrors selection/changed payload into chat scope (documents + folders + paths)_                                                    |
| 2   | `selection/changed` with empty arrays clears chat scope.                                               | `IndexerHost.test.tsx` — _clears chat scope when selection/changed arrives with empty arrays_                                                                 |
| 3   | `document/selected` only opens the viewer; chat scope is unchanged.                                    | `IndexerHost.test.tsx` — _does not auto-scope chat when document/selected fires (clicks only open viewer)_                                                    |
| 4   | Reducer dedupes incoming arrays by id and truncates at the cap.                                        | `chatScopeReducer.test.ts` — _dedupes incoming arrays by id_ + _truncates incoming arrays to the per-array cap_                                               |
| 5   | `ScopeIndicator` chips render filenames / folder names from the event payload, no metadata round-trip. | `ScopeIndicator.test.tsx` — _renders one chip per document and folder using the event-supplied names_ + _exposes the folder path as the chip title attribute_ |
| 6   | No axe violations on populated indicator.                                                              | `ScopeIndicator.test.tsx` — _has no axe violations in the populated state_                                                                                    |

## Known divergence (intentional, documented)

The chat-side `× Remove` and `Clear all` affordances on `<ScopeIndicator>` are **local overrides** — they update chat-scope state but do NOT push back to the indexer's selection UI. The next `selection/changed` mutation re-syncs the chip rack to the indexer's authoritative set.

Trade-off accepted: the alternative is either (a) removing the affordances entirely (forces the user back to the indexer to clear scope mid-conversation) or (b) adding an imperative `IndexerHandle.setSelection(...)` method to push back (host-contract evolution, indexer-team coordination). v1 keeps the affordances and flags the temporary inconsistency. Revisit if user feedback warrants the back-channel.

## Follow-ups

- Optional: add an imperative `IndexerHandle.setSelection(documentIds, folderIds)` method to make the chip × push back to the indexer, removing the known divergence. Coordinate with the indexer team if pursued.
- E2E: extend `e2e/app.spec.ts` with a critical-path "select-in-indexer → chat answer narrows" once the deployed indexer ships its multi-select UI (jest unit tests cover the event wiring; the full user flow needs the real indexer).
