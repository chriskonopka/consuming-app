# `features/citations/`

## What belongs here

Inline `[N]` markers, the source-list expander, and `useCitationClick()` — the callback that opens the viewer + calls `indexerRef.current?.revealDocument(documentId)`. Citations missing coordinates render with strike-through + "Unverified" tooltip (audited via `auditCitation()` in `@shared/types/citation`).

## What does not belong here

- Holding citation state — citations live inside `ChatSession.streaming.citations` and `ConversationHistory.messages[].citations`, owned by `features/chat/`.
- Opening the viewer directly — calls a callback from `chat/` which composes the open-viewer + reveal-document action.
- Drift-guard logic for highlight rectangles — that's geometry-based and runs in `features/viewer/` after pdf.js reports page dimensions.

## Status

Implemented in slice 4 — `<CitationMarker>`, `<SourceList>`, `useCitationClick`. Doc-type pills and section headings on source rows are deferred per REQUIREMENTS.md §10 (need a `GET /documents/{id}` round-trip).
