# `features/indexer-host/`

## What belongs here

The MF host wiring: lazy-load `mws_indexer/IndexerApp`, mount it inside the app shell's main canvas, route every `IndexerEvent` to the right reducer, and expose the `IndexerHandle` ref via `useIndexerRef()` so other features can call `selectCollection` and `revealDocument`. URL routing for `/c/{id}?folderId=&documentId=` is owned here (delegating to `hooks/useUrlState.ts`).

Critical: every `IndexerEvent` type must have a handler. New event types added to the host contract block scaffold review until a handler is written.

## What does not belong here

- Any chat or viewer UI (siblings).
- Any indexer-internal state (the indexer manages its own under `mws-indexer:` IndexedDB / localStorage namespace — off-limits to this app).
- Modifications to `mws_indexer/types` — that contract is owned by the indexer project; coordinate before changing.

## Files

- `IndexerHost.tsx` — lazy `<IndexerApp>` mount + ErrorBoundary + Suspense + URL↔indexer reconciliation effect.
- `IndexerHostContext.tsx` — Context that owns `IndexerHostState` + the imperative `IndexerHandle` ref.
- `eventRouter.ts` — pure dispatcher for the five `IndexerEvent` types.
- `indexerHostReducer.ts` — `IndexerHostState` reducer (collection mirror + remountKey counter).
- `loadIndexerApp.ts` — picks between the federated remote and the E2E stub via `MSAL_E2E_STUB`.
- `IndexerApp.e2eStub.tsx` — Playwright-only stub of `<IndexerApp>` (dead-code-eliminated in production).
- `__mocks__/loadIndexerApp.ts` — jest manual mock that returns the stub.

## Status

Implemented in slice 2.
