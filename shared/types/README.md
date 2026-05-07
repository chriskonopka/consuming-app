# `shared/types/`

## What belongs here

The cross-module type vocabulary every layer of the consuming app speaks: API DTOs (mirrored from the GlobalIndexer API contract), auth state types, chat session types, citation types, viewer types, indexer host-contract re-exports, layout types. See [`../../docs/architecture/shared-types.md`](../../docs/architecture/shared-types.md) for the per-file index.

The barrel `index.ts` here is intentional — types are erased at compile time, so the tree-shaking concern that forbids barrels in `src/components/` does not apply.

## What does not belong here

- Runtime values — only types and small pure helpers (e.g. `auditCitation`, `groupCitationsBySource`, `driftGuard`, `toLocalMessage`, `toCitationRect`, `MODEL_PICKER_TO_PROVIDER`, persistence-key constants). These are pure and trivially tested.
- Anything specific to one module's internal state.
- React component types — those go in the component files.

## Where the rest of the "shared" inventory lives

Per `module-boundaries.md`, the consuming app's shared utilities, components, and hooks live under `src/` (`src/utils/`, `src/components/`, `src/hooks/`) — not at the project root. This is the standard SPA convention. See `docs/architecture/scaffold-notes.md` §"Divergence: shared/ at project root vs. src/" for the rationale.

## Status

Scaffolded — types fully defined in Step 1 (`/build-architecture`).
