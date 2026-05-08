# Architecture

Locked artifacts for the consuming app. Read in this order on first arrival; thereafter dip into the file you need.

| File | Purpose |
|---|---|
| [`data-model.md`](data-model.md) | Client-side state, what the app holds, what it persists, and where |
| [`api-contracts.md`](api-contracts.md) | MF host contract + the GlobalIndexer API endpoints we consume |
| [`module-boundaries.md`](module-boundaries.md) | What each module owns, exposes, and must not do |
| [`shared-types.md`](shared-types.md) | Index of `/shared/types/` — the cross-module type vocabulary |
| [`dependency-graph.md`](dependency-graph.md) | Module → module edges + acyclic check + external deps |
| [`shared-inventory.md`](shared-inventory.md) | Shared utilities, primitives, and infra helpers + scaffold status |
| [`slice-plan.md`](slice-plan.md) | Locked slice plan — count, ceiling, drift cap, mapping back to spec |
| [`scaffold-notes.md`](scaffold-notes.md) | Decisions and divergences surfaced during `/build-scaffold` |
| [`01-slice-app-shell-auth-telemetry.md`](01-slice-app-shell-auth-telemetry.md) | Slice 1 — sign-in via Entra ID, themed app shell, persistence plumbing |
| [`02-slice-indexer-host-integration.md`](02-slice-indexer-host-integration.md) | Slice 2 — Module Federation host, indexer mount + event router, URL deep-link, useApiClient + useUrlState |
| [`03-slice-chat-panel-sse-streaming.md`](03-slice-chat-panel-sse-streaming.md) | Slice 3 — chat panel, SSE streaming, conversation lifecycle, status-row simulator, shared UI primitives |
| [`04-slice-citations-pdf-viewer.md`](04-slice-citations-pdf-viewer.md) | Slice 4 — citations + PDF viewer, drift guard, source list, viewer panel wiring |

## Source spec

The architecture traces back to [`../../REQUIREMENTS.md`](../../REQUIREMENTS.md). Every slice in `slice-plan.md` maps to one or more numbered sections of the spec; deferred items are explicitly listed.

## Related external contracts

The host contract this app integrates against:

- [`../../../reusable-indexer/shared/types/host-contract.ts`](../../../reusable-indexer/shared/types/host-contract.ts) — locked surface (props / events / ref API)
- [`../../../reusable-indexer/docs/architecture/module-boundaries.md`](../../../reusable-indexer/docs/architecture/module-boundaries.md) — what the indexer owns vs. what the consuming app owns
- [`../../../reusable-indexer/frontend-api-contract.md`](../../../reusable-indexer/frontend-api-contract.md) — every API endpoint we call

Changes to any of those require coordination with the indexer project; **never** modify them from this side.
