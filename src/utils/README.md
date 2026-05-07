# `utils/`

## What belongs here

Pure, stateless functions. No React, no side effects on import. Each file:

- `parseSse.ts` — `ReadableStream` → `AsyncIterable<SseEvent>`
- `problemDetails.ts` — `Response` → typed `ProblemDetails | null`
- `bytesToBlobUrl.ts` — `Stream | Blob` → object URL
- `idb.ts` — IndexedDB primitive get / set / delete (the only place that touches `indexedDB`)

Functions exported here are testable as plain functions (no `renderHook` needed).

## What does not belong here

- React hooks — those live in `hooks/`.
- Anything that holds state across calls.
- Direct `console.*` (use App Insights in calling code if logging is needed).
- Anything that requires a DOM beyond what `Response`, `ReadableStream`, `Blob`, and `URL` provide — those work in jsdom.

## Status

Scaffolded — `idb` lands in slice 1, `problemDetails` in slice 2, `parseSse` in slice 3, `bytesToBlobUrl` in slice 5.
