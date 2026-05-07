# Shared Types — Index

The vocabulary every module speaks. Files live under `/shared/types/`. Modules import from `@shared/types` (path alias configured in `tsconfig.app.json`).

| File | What it exports | Owning module(s) |
|---|---|---|
| [`api-dtos.ts`](../../shared/types/api-dtos.ts) | DTOs mirroring the GlobalIndexer API: `DocumentSetSummary`, `ConversationResponse`, `MessageResponse`, `CitationData`, `DocumentMetadataResponse`, SSE event payloads, `ProblemDetails`, pagination shapes. Stable enums: `AccessRole`, `LlmProvider`, `DocumentStatus`, `FileTypeCode`. | All — read-only mirrors |
| [`auth.ts`](../../shared/types/auth.ts) | `AuthState`, `AccountInfo`, `GetAccessToken` (the canonical token-acquisition function type) | `auth/`, `indexer-host/`, `hooks/useApiClient.ts` |
| [`chat.ts`](../../shared/types/chat.ts) | `ChatSession`, `StreamingState`, `LocalMessage`, `ModelPickerOption` + `MODEL_PICKER_TO_PROVIDER`, `SimulatedPhase`, `toLocalMessage()` | `features/chat/` |
| [`citation.ts`](../../shared/types/citation.ts) | `Citation` (alias of API's `CitationData`), `AuditedCitation`, `CitationAuditStatus`, `SourceGroup`, `auditCitation()`, `groupCitationsBySource()` | `features/citations/` |
| [`viewer.ts`](../../shared/types/viewer.ts) | `ViewerState`, `OpenDocument`, `CitationRect`, `PageRenderState`, `DRIFT_GUARD_MAX_PAGE_FRACTION`, `driftGuard()`, `toCitationRect()` | `features/viewer/` |
| [`indexer-host.ts`](../../shared/types/indexer-host.ts) | Re-exports `IndexerAppProps`, `IndexerEvent`, `IndexerHandle`, `IndexerInitialState`, `ThemeTokenKey` from `mws_indexer/types`. Plus local `IndexerHostState`, `ActiveCollection`. | `features/indexer-host/` |
| [`layout.ts`](../../shared/types/layout.ts) | `LayoutState`, `PanelState`, `Theme`, `PERSISTENCE_KEYS`, `THEME_PREFERENCE_KEY`, default widths | app shell, `theme/` |
| [`index.ts`](../../shared/types/index.ts) | Barrel re-export of all of the above | — |

---

## Versioning rule

Any change to `api-dtos.ts` must be made in lock-step with [`../../../reusable-indexer/frontend-api-contract.md`](../../../reusable-indexer/frontend-api-contract.md). Add a comment in `api-dtos.ts` recording the contract version, and run a re-review of `module-boundaries.md` and `data-model.md` for downstream impact.

The host-contract types in `indexer-host.ts` are re-exported from the indexer's federation surface. Changes there are **not** in this app's authority — they require coordination with the indexer project's owners (call out the change in the consuming app's PR description and link the indexer-side change).

---

## Why a barrel here when not in `src/components/`?

`/shared/types/` is a type-only surface with no runtime cost — TypeScript erases the imports at compile time. The argument against barrels in `src/components/` (preserving tree-shaking of runtime code) does not apply.
