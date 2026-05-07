# `components/`

## What belongs here

Shared UI primitives reused by 2+ features: `<Splitter>`, `<Panel>`, `<Tooltip>`, `<Pill>`, `<IconButton>`, `<LoadingSpinner>`, `<ErrorBoundary>`. Each lives in its own folder with `index.tsx` (named export only — per `web-component-architecture.md`), `*.module.scss`, and `*.test.tsx`.

Per `web-file-structure.md`: **no barrel `index.ts` in this directory**. Import from each component folder directly so tree-shaking isn't broken by re-export chains.

## What does not belong here

- Feature-specific components (`<ChatPanel>`, `<DocumentViewer>`, `<CitationMarker>`, `<SourceList>`, `<UserMenu>`, etc.) — those live in their feature folders.
- Hooks — `src/hooks/` for shared, feature folders for feature-local.
- Anything tied to a specific feature's data model.

## Status

Scaffolded — full implementations land per slice plan: Splitter / Panel / Pill / IconButton / LoadingSpinner in slice 3, Tooltip in slice 4, ErrorBoundary already implemented (template-provided).
