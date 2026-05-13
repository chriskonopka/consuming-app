# `features/viewer/`

## What belongs here

Right-side panel rendering of document content. PDFs use pdf.js with three layers (canvas + text layer + highlight overlay) per REQUIREMENTS.md §4.5.4 / §5.4. Images use the blob-URL pattern (auth-fetched, then `<img src=blobUrl>`) because `<img>` cannot carry an `Authorization` header.

Citation highlights run through the drift guard (`driftGuard` in `@shared/types/viewer`) — highlights covering > 50% of visible page height are rejected and the "Couldn't locate this quote" fallback fires. (Raised from 25% on 2026-05-13 to accommodate the API's section-sized citation rectangles; see `DRIFT_GUARD_MAX_PAGE_FRACTION` in `viewer.ts`.)

## What does not belong here

- Fetching PDF content directly via raw fetch — uses `useApiClient()` for the auth header. pdf.js gets a custom loader that calls into the same client.
- Re-validating citation text content (the API has already done this; we only validate geometry).
- Client-side OCR (server-side vision pipeline handles scanned PDFs during ingestion — see REQUIREMENTS.md §5.6 "Removed from original doc spec").
- Inline rendering of Word / spreadsheet — deferred to v2 per REQUIREMENTS.md §10. v1 shows a download button.

## Status

PDF rendering + drift guard implemented in slice 4 — `<DocumentViewer>`, `viewerReducer`, `<ViewerProvider>` / `useViewer`, `usePdfDocument`, `usePdfPage`, `<HighlightOverlay>`, `<PageNavigation>`, `<ViewerHeader>`. Image rendering, "Preview not available" fallback, and responsive polish land in slice 5.
