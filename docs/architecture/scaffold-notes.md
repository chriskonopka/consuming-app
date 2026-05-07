# Scaffold Notes

Decisions, gaps, and contract clarifications surfaced during Step 2 (`/build-scaffold`). Read alongside `module-boundaries.md` and `shared-inventory.md`.

---

## 1. Divergence — `shared/` at project root vs. `src/`

**The build-scaffold skill template assumes a backend-monorepo project shape** (multiple language packages, infra under `/shared/`). The consuming app is a single SPA, so:

- **`/shared/types/`** lives at the project root (mirrors the indexer's convention; serves as the cross-module type vocabulary).
- **`/shared/utils/`, `/shared/components/`, `/shared/hooks/`** do **not** exist. Their entries from `shared-inventory.md` live under `src/`:
  - `src/utils/` (parseSse, problemDetails, bytesToBlobUrl, idb)
  - `src/components/` (Splitter, Panel, Tooltip, Pill, IconButton, LoadingSpinner, ErrorBoundary)
  - `src/hooks/` (useApiClient, usePersistedReducer, useAbortable, useDebouncedValue, useUrlState)

This matches `module-boundaries.md` §1 ("Top-level layout") which was already written this way in Step 1, and matches the indexer's `web/src/` layout. **Confirmed: this is the right shape for a single-app SPA.** No re-architecture needed; the divergence is from the skill's monorepo assumptions, not from our own architecture.

Each directory has a `README.md` explaining what belongs / does not belong, satisfying Step 4's "slice author scans `/shared/` once and knows where to import from" intent.

---

## 2. Module Federation — deferred to slice 2

Webpack config has the `@shared` alias and the env-var DefinePlugin entries needed for slice 1. **`ModuleFederationPlugin` is intentionally NOT installed yet** — slice 2 owns it. Reasons:

- The `mws_indexer/IndexerApp` runtime entry isn't consumed by the scaffold (no slice 1 work needs it). Adding the plugin now would require setting up a dev-time resolution path (the indexer running on `localhost:3001`) for no scaffold-level benefit.
- TypeScript still resolves `mws_indexer/types` cleanly via the tsconfig path mapping → the indexer's actual `host-contract.ts`. No `.d.ts` shim needed.
- Jest resolves the same path via `moduleNameMapper` in `jest.config.ts`.

**What slice 2 must add:** `@module-federation/enhanced` dep, `ModuleFederationPlugin` block in `webpack.config.js` consuming `mws_indexer@${INDEXER_REMOTE_URL}/remoteEntry.js`, and the lazy `React.lazy(() => import('mws_indexer/IndexerApp'))` in `features/indexer-host/IndexerHost.tsx`.

---

## 3. Health-check substitution

The skill's "health-check endpoint" pattern is server-oriented. For a SPA, the equivalent is a runtime page that surfaces the boot state. The scaffold ships `src/health/HealthPage.tsx` which:

- Renders the env-var presence (without leaking secret values — masks the MSAL clientId and App Insights connection string)
- Reports `OK` or `Degraded` based on which required keys are missing
- Is mounted as the only content of `<AppShell>` for now (slice 1 moves it behind a `/health` route so it remains accessible after the app shell fills out)

**Boot proof:** `npm run build` produces a clean production bundle, `npx tsc --noEmit` succeeds, `npm test` passes (HealthPage + AppShell tests, both with axe assertions). See "Step 6" in this scaffold's report.

---

## 4. Coverage threshold — relaxed at scaffold time

`jest.config.ts` enforces 80% coverage globally. The scaffold ships ~25 placeholder modules with no tests. Running `npm run test:coverage` against the scaffold WILL fail the threshold — this is expected.

**Decision:** the coverage gate applies at slice review (each slice brings its directory of placeholders to coverage), not at scaffold review. Plain `npm test` (no `--coverage` flag) is the scaffold-stage gate; full coverage is restored slice-by-slice.

When slice 1 lands, `auth/`, `theme/`, `telemetry/`, and `app-shell/` enter coverage. Slice 2 brings `features/indexer-host/`, the API client, and URL state. Etc. By the end of slice 5, every file under `collectCoverageFrom` should meet the 80% bar.

Do not weaken `coverageThreshold` itself — gate the slice-level enforcement, not the long-term standard.

---

## 5. Dependencies installed at scaffold

**Only the template-provided deps.** No new runtime deps were installed. Slice-specific deps install in their slices (per `dependency-graph.md` §4):

| Dep | Installed by |
|---|---|
| `@azure/msal-browser`, `@azure/msal-react`, `react-router-dom@^7` | Slice 1 |
| `@module-federation/enhanced` (matching indexer's exact version) | Slice 2 |
| `@tanstack/react-query`, `@phosphor-icons/react` | Slice 3 |
| `pdfjs-dist` (`--save-exact`) | Slice 4 |

This keeps the scaffold review focused on structure rather than dependency choices.

---

## 6. Template files removed

| File | Reason |
|---|---|
| `src/App.tsx`, `src/App.module.scss`, `src/App.test.tsx` | Template demo splash; replaced by `<AppShell>` and `<HealthPage>` |
| `src/assets/` (Northstar CLI logo) | Demo asset; no slice references it |
| `src/ErrorBoundary.tsx` | Moved to `src/components/ErrorBoundary/index.tsx` per `web-component-architecture.md` (each component in its own folder) |

The template's other infrastructure (`setupTests.ts` polyfills, `test-utils.ts` IDB helpers, `__mocks__/`, `jest.config.ts`, `playwright.config.ts`, `.prettierrc`, `eslint.config.mjs`, `Dockerfile.dev`, `docker-compose.yml`, `.devcontainer/`) is preserved as-is.

---

## 7. Telemetry singleton location

`shared-inventory.md` and `module-boundaries.md` both reference the App Insights singleton at `src/appInsights.ts`. The template put it there; we kept it. The `telemetry/` module re-exports it as the canonical import path for everything telemetry-related — direct imports of `@microsoft/applicationinsights-web` outside `appInsights.ts` are forbidden.

---

## 8. Open architectural questions (NOT defects — flagged for slice owners)

- **Slice 1 — sign-in screen design.** The scaffold has no design for the unauthenticated state. REQUIREMENTS.md §3.3 just says "loginPopup" — needs a branded splash screen design. Slice 1 PR can either ship a minimal one or stop and ask.
- **Slice 1 — react-router strategy.** Hand-rolled vs `react-router-dom` was decided in `dependency-graph.md` (router). The scaffold doesn't use a router yet (`<HealthPage />` is the only mounted content). Slice 1 introduces `<BrowserRouter>` and the route table.
- **Slice 2 — `INDEXER_REMOTE_URL` for production.** Dev value documented; production hosting (Azure Static Web Apps? Azure Front Door?) is not. Surface during slice 2.
- **Slice 4 — pdf.js worker hosting.** pdf.js needs a separate worker file. Webpack 5 + `pdfjs-dist@^4` ships a worker that can be inlined or served separately. Slice 4 picks a strategy.
