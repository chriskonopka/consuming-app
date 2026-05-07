# `features/citations/`

## What belongs here

Inline `[N]` markers, the source-list expander, and `useCitationClick()` — the callback that opens the viewer + calls `indexerRef.current?.revealDocument(documentId)`. Citations missing coordinates render with strike-through + "Unverified" tooltip (audited via `auditCitation()` in `@shared/types/citation`).

## What does not belong here

- Holding citation state — citations live inside `ChatSession.streaming.citations` and `ConversationHistory.messages[].citations`, owned by `features/chat/`.
- Opening the viewer directly — calls a callback from `chat/` which composes the open-viewer + reveal-document action.
- Drift-guard logic for highlight rectangles — that's geometry-based and runs in `features/viewer/` after pdf.js reports page dimensions.

## Status

Scaffolded — implementation lands in slice 4 (Citations + PDF viewer).
