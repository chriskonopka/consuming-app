# Handoff to the indexer team — `selection/changed` host-contract event

**Audience:** the reusable-indexer (mws_indexer) front-end team.
**Author:** consuming-app front-end team, 2026-05-11.
**Status:** proposal — needs review before implementation.
**Companion:** `docs/architecture/05-slice-chat-scope-selection.md` (consumer side, already implemented and shipping).

---

## Why

The consuming app now supports **selection-narrowed chat retrieval** — when the user picks one or more documents (and, eventually, folders) in the indexer, the next chat send asks the API to narrow retrieval to that selection. The API contract for this landed in `SindhuraG-lab/GlobalAPI#1` (commit `60ebdf9`):

```ts
interface SendMessageRequest {
  content: string;
  llmProvider?: 'Claude' | 'OpenAi';
  documentIds?: string[]; // GUIDs, max 64
  folderIds?: string[]; // GUIDs, max 64
}
```

The consumer is already plumbed end-to-end: a context + reducer track the selection, the chat panel renders a scope-indicator chip rack with remove + clear, and `useSseChat` forwards the arrays in the message body. **What's missing is a signal from the indexer telling the consumer what's selected.**

Today, the consuming app uses the existing `document/selected` event as a **transitional bridge**: a single click in the file list both opens the viewer AND toggles the doc in chat scope. A second click on the same doc removes it. This works but conflates two concerns and offers no path to multi-select or folder-scope.

---

## What we're asking for

A new `IndexerEvent` variant the indexer emits whenever the user's chat-scope selection changes, plus the indexer-side UI to drive it. The consumer subscribes through the existing `onEvent` prop — no change to `IndexerAppProps` or `IndexerHandle`.

### Proposed contract

In `reusable-indexer/shared/types/host-contract.ts`, add:

```ts
/**
 * The user's chat-scope selection changed. Emitted whenever the indexer's
 * internal selection state (whatever UI drives it — checkboxes, selection
 * mode, folder picker, etc.) transitions to a new set. Emitted with empty
 * arrays when the user clears the selection.
 *
 * Distinct from `document/selected` (which is a click-to-open-viewer event,
 * fires on every row click regardless of selection state). The consumer
 * uses this event as the authoritative source of "what is the next chat
 * send scoped to."
 *
 * Cap: per-array maximum of 64 (matches the API's ValidationFailed
 * boundary). The indexer's UI should prevent the user from selecting more.
 *
 * Folder vs. document semantics on the API side: OR-of-whitelists. A
 * folder in `folderIds` matches every document tagged with that folder at
 * index time; documents in `documentIds` add to that set. The API ANDs the
 * union with the active DocumentSet.
 */
| {
    type: 'selection/changed';
    documentSetId: string;
    documentIds: string[];
    folderIds: string[];
  }
```

Add the new variant to the existing union (don't break exhaustiveness for current consumers — TypeScript's exhaustive switch in their event router will flag the missing case at compile time, which is the desired behavior).

### Optional but nice-to-have

If the indexer can include display labels in the payload, the consumer can avoid extra `GET /documents/{id}` round-trips just to label chips:

```ts
| {
    type: 'selection/changed';
    documentSetId: string;
    documents: { documentId: string; fileName: string }[];
    folders: { folderId: string; folderName: string; path: string }[];
  }
```

Either shape is fine — the consumer is currently coded against the id-only shape and falls back to `useDocumentMetadata` for filenames (TanStack Query caches across the viewer, so it's usually a cache hit). The richer shape removes the fallback path entirely for folder chips, which today render as `Folder 1`, `Folder 2`, … because the consumer has no folder-name source.

**Our recommendation:** ship the richer shape. The indexer already has these labels in its file list and folder tree.

---

## Behavioral guarantees we need

1. **Emit on every change, including back to empty.** The consumer mirrors the event into its own state; missing a "now empty" emit would leave stale chips.
2. **Per-array cap of 64.** The indexer's UI should not let the user select a 65th item. The consumer's reducer also caps adds (belt-and-suspenders), and `useSseChat` does a pre-flight check before fetch, but the indexer is the right place to surface the limit to the user.
3. **Emit on collection switch.** When the user activates a different DocumentSet (which already emits `collection/activated`), emit `selection/changed` with empty arrays as well so the consumer's clear is event-driven, not derived. The consumer also resets scope on `collection/activated` defensively — that's fine, two clears is idempotent.
4. **Empty arrays, not absent.** Always emit both arrays even when one is empty. Keeps the consumer's destructure simple.
5. **No emit on initial mount unless the indexer is restoring a deep-linked selection.** The consumer's initial state is empty arrays; a redundant empty emit on every mount would still be fine, just unnecessary.

---

## Indexer UI work (your call on the design)

We're not opinionated on the UX — your file list and folder tree, your call. Some patterns to consider:

- **Selection mode toggle**: a button in the file-list toolbar that flips rows from "click-to-open" to "click-to-select", with checkboxes appearing in selection mode.
- **Modifier-key multi-select**: shift/cmd-click adds to selection, plain click opens. Familiar but easy to miss.
- **Always-on checkboxes**: simple, no mode switch, slightly busier file list.
- **Folder-tree multi-select**: independent of document selection; OR semantics on the API side (a folder in scope matches any doc in that folder regardless of whether the doc is also explicitly selected).

Whatever you ship, the **consumer just needs the event** with the resulting arrays.

---

## What changes on the consumer once you ship this

Small, mechanical. From `src/features/indexer-host/IndexerHost.tsx`:

```ts
// BEFORE (transitional bridge — clicking a doc affects chat scope)
onDocumentSelected: (event) => {
  openViewer(event.documentId, 1, null);
  chatScope.toggleDocument(event.documentId);
},

// AFTER (clean separation — clicks open viewer only)
onDocumentSelected: (event) => {
  openViewer(event.documentId, 1, null);
},
onSelectionChanged: (event) => {
  chatScope.setSelection(event.documentIds, event.folderIds);
},
```

Plus a new case in `src/features/indexer-host/eventRouter.ts` for the new variant — TypeScript will tell you exactly where.

If you ship the richer payload (with names), `ScopeIndicator.tsx` swaps its `useDocumentMetadata`/`Folder N` placeholder lookups for the labels in the event. Smaller still.

---

## Timeline

The consumer is ready to use the event the moment it ships. Nothing on our side blocks deploy of the indexer change. We'd be grateful for it because the bridge behavior (click = open viewer AND toggle scope) is a known UX wart we're carrying in production until the new event lands.

Questions / pushback / "we'd rather do (C) `getSelection()` than an event" — happy to revisit. The reason we picked an event over a pull-model ref method is that the scope-indicator UI needs to update reactively when selection changes; a pull model means the consumer either polls or wires its own selection signal somehow. An event is push, simple, and fits the existing `onEvent` channel.
