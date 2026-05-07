# `features/indexer-host/`

## What belongs here

The MF host wiring: lazy-load `mws_indexer/IndexerApp`, mount it inside the app shell's main canvas, route every `IndexerEvent` to the right reducer, and expose the `IndexerHandle` ref via `useIndexerRef()` so other features can call `selectCollection` and `revealDocument`. URL routing for `/c/{id}?folderId=&documentId=` is owned here (delegating to `hooks/useUrlState.ts`).

Critical: every `IndexerEvent` type must have a handler. New event types added to the host contract block scaffold review until a handler is written.

## What does not belong here

- Any chat or viewer UI (siblings).
- Any indexer-internal state (the indexer manages its own under `mws-indexer:` IndexedDB / localStorage namespace — off-limits to this app).
- Modifications to `mws_indexer/types` — that contract is owned by the indexer project; coordinate before changing.

## Status

Scaffolded — implementation lands in slice 2 (Indexer host integration).
