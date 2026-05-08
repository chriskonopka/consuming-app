# `features/chat/`

## What belongs here

The chat panel UI, conversation lifecycle (resolve existing on activate, lazy-create on first send, soft-delete on Clear), SSE streaming client (`useSseChat()` wrapping `fetch` + `ReadableStream` + `AbortController`), status row simulator (5-phase + fallback cycle), and TanStack Query keys for conversations + history. v1 hardcodes `llmProvider: 'Claude'` (→ Claude Opus 4.7 server-side); the model picker UI is deferred (REQUIREMENTS.md §4.9, §10).

Citation marker rendering is delegated to `features/citations/`. PDF/image rendering of cited pages is delegated to `features/viewer/`.

## What does not belong here

- PDF or image rendering — `features/viewer/`.
- Citation marker / source-list rendering — `features/citations/`.
- Mirroring conversation messages to IndexedDB (server-authoritative).
- A separate fetch wrapper — use `hooks/useApiClient.ts`.
- `EventSource` for SSE — must use `fetch` + `ReadableStream` to support `Authorization` and `POST`.

## Status

Scaffolded — implementation lands in slice 3 (Chat panel + SSE streaming).
