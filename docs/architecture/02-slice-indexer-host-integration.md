# Slice 02 — Indexer host integration

> **Capability:** *"User browses collections, folders, and files via the embedded indexer. URL reflects the active collection (`/c/{id}`). Back-button works."*
> **Spec sections:** REQUIREMENTS.md §2 (Module Federation host integration end-to-end)
> **Slice plan entry:** [`slice-plan.md`](slice-plan.md) → "Slice 2: Indexer host integration"
> **Status:** Completed

This document is a snapshot of what happened during the slice. Living architecture docs (`module-boundaries.md`, `data-model.md`, etc.) are updated separately when a later slice changes the same surface.

---

## Layers changed

### Module Federation (`webpack.config.js`)
- Added `@module-federation/enhanced/webpack` `ModuleFederationPlugin`. Host name: `consuming_app`. Remote: `mws_indexer@${INDEXER_REMOTE_URL}/remoteEntry.js`. Strict singletons for `react`, `react-dom`, and `react-dom/client` (matching the indexer's federation surface in `../reusable-indexer/web/webpack.config.js`).
- Added an `mfRuntime` `splitChunks` cacheGroup so the federation runtime is its own chunk separate from the React vendor bundle.
- Defensive runtime URL: when `INDEXER_REMOTE_URL` is empty (CI/test bundling), the remote falls back to `http://localhost/__indexer-not-configured__/remoteEntry.js` — fails loudly at runtime rather than silently at build time. Slice 5 owns the *production* origin guard (security review §1).

### `features/indexer-host/` (real implementation)
- `IndexerHost.tsx` — top-level boundary. Snapshots `useUrlState()` once on mount to seed `IndexerInitialState`, builds the reducer via `useReducer(indexerHostReducer, initialState, buildInitialIndexerHostState)`, and provides the context. The inner `IndexerMount` consumes the context, lazy-loads `<IndexerApp>` via `React.lazy(loadIndexerApp)`, wraps in `<Suspense>` + `<ErrorBoundary>`, passes the locked prop set, and runs the URL→indexer reconciliation effect.
- `IndexerHostContext.tsx` — `IndexerHostContextProvider` plus `useActiveCollection()`, `useIndexerRef()`, `useIndexerHostState()`. The `indexerRef` is a stable `useRef<IndexerHandle | null>` populated by React when the lazy component mounts.
- `eventRouter.ts` — pure dispatcher for the five `IndexerEvent` types with a compile-time exhaustiveness guard (`const exhaustive: never = event`). Adding a new event variant upstream now blocks compilation until a case is added.
- `indexerHostReducer.ts` — discriminated-union reducer with `COLLECTION_ACTIVATED` and `INCREMENT_REMOUNT_KEY` actions. Exhaustive switch, no `default` (per `web-state-management.md`).
- `loadIndexerApp.ts` — picks between the federated `import('mws_indexer/IndexerApp')` and the local E2E stub via `process.env.MSAL_E2E_STUB === 'true'`. Same dead-code-elimination pattern slice 1 used for the MSAL seam.
- `IndexerApp.e2eStub.tsx` — Playwright-only stub that mirrors `IndexerAppProps` + `IndexerHandle`. Two stub collections + an "Open stub document" button drive the deep-link / URL-round-trip / back-button E2E. Three "Trigger" buttons (`auth/expired`, `error/unhandled`, `collection/list-changed`) drive the corresponding host-handler tests in jest.
- `__mocks__/loadIndexerApp.ts` — manual mock that returns the e2e stub. Tests `jest.mock('./loadIndexerApp')` to bypass the federation runtime.

### Cross-cutting hooks (real implementations)
- `src/hooks/useApiClient.ts` — typed fetch wrapper. Prepends `config.apiBaseUrl`, adds `Authorization: Bearer <token>`, parses `application/problem+json` into a typed `ApiError`, captures `X-Operation-Id` to App Insights via `trackDependencyData`, retries once on 401 then calls `useAuth().expireAuth()` on the second 401. Same `getAccessToken` reference handed to the indexer is used here (CLAUDE.md §"Token uniformity").
- `src/hooks/useUrlState.ts` — push/parse `/c/{documentSetId}?folderId=&documentId=`. Uses `useMatch('/c/:documentSetId')` (not `useParams`) so the AppShell stays mounted under a single catch-all route — switching between `/` and `/c/{id}` does not unmount the shell or the lazy-loaded indexer chunk.
- `src/utils/problemDetails.ts` — RFC 7807 parser with type-guard validation. Used by `useApiClient` and (slice 3) the SSE pre-stream error path.

### Routing (`src/bootstrap.tsx`)
- Consolidated `/c/:documentSetId` and `*` into a single `path="*"` route that renders `<AuthGate><AppShell /></AuthGate>`. The collection id is read inside `useUrlState` via `useMatch`, so navigation between `/`, `/c/abc`, and `/c/def` does not unmount the shell. Without this, react-router would remount on every collection change and discard the lazy-loaded indexer chunk.

### App shell (`src/app-shell/AppShell.tsx`)
- Replaced the slice-1 `<div className={styles.placeholder}>Welcome…</div>` with `<IndexerHost />`.
- Brand element promoted from `<span>` to `<h1>` to satisfy the `page-has-heading-one` axe rule on the signed-in shell. Slice 1 satisfied the rule via the placeholder's `<h1>Welcome</h1>`; replacing the placeholder lost that heading.

### Auth (`src/auth/msalInstance.e2eStub.ts`)
- Persists the stub's active account in `sessionStorage` (key `msal-e2e-stub-active`). Without this, every Playwright `page.goto` reloaded the JS module and reset the stub to signed-out, breaking the slice-2 deep-link E2E. Real MSAL persists the same way; this brings the stub into line.

### Test harness (`src/setupTests.ts`, `src/test-utils.ts`, `src/auth/__mocks__/msalInstance.ts`, `jest.config.ts`)
- `setupTests.ts` — minimal `Headers`/`Response` shim (Map-backed, supports `.get/.set/.has`, `.json()`, `.text()`, `.clone()`, `.ok`, `.status`). undici was the obvious choice but kept the Node event loop alive after tests finished, causing worker-leak warnings; the shim covers our test surface in ~50 lines without timers/connection pools.
- `test-utils.ts` — bumped `flushIDB` from 50 ms to 150 ms; coverage-instrumented runs were intermittently failing the slice-1 hydration tests on the lower budget.
- `auth/__mocks__/msalInstance.ts` — added `getLogger()` (and other surface) needed by `@azure/msal-react`'s `MsalProvider` so any test that wraps in `<MsalAppProvider>` resolves.
- `jest.config.ts` — added `'^mws_indexer/IndexerApp$' → 'src/features/indexer-host/IndexerApp.e2eStub.tsx'` moduleNameMapper as a safety net for any test that hits the federated dynamic import without explicitly mocking `loadIndexerApp`. (`mws_indexer/types` is type-only and erased at transpile time, no mapping needed.) Removed the slice-2 placeholder coverage exclusions; added an exclusion for `IndexerApp.e2eStub.tsx` (mirrors the `msalInstance.e2eStub.ts` treatment).

### Tests
- 25 jest suites, **132 tests passing**. Coverage: 94.01 % statements / 84.29 % branches / 86.71 % functions / 95.7 % lines — comfortably above the 80 % floor.
- New unit tests: `eventRouter.test.ts` (every event type + exhaustiveness), `indexerHostReducer.test.ts` (initial state + actions + invariants), `IndexerHost.test.tsx` (URL deep-link → mount, URL push on `collection/activated`, `auth/expired` → expired status + remount key bump, `error/unhandled` no-throw, `document/selected` no-op, axe), `IndexerHostContext.test.tsx` (out-of-provider hook throws), `useUrlState.test.tsx` (path/query parse, push semantics), `useApiClient.test.tsx` (Authorization header, problem+json → ApiError, 401-retry, second-401 → expireAuth, raw, 204, init pass-through), `problemDetails.test.ts` (content-type gate, malformed body, charset suffix, body-not-consumed).
- E2E (`e2e/app.spec.ts`): 5 new slice-2 scenarios — root mount with no active collection, click → `/c/{id}` URL push, back-button restoration, deep-link mount, `auth/expired` → sign-in screen.

### Dependencies installed
| Package | Version | Reason |
|---|---|---|
| `@module-federation/enhanced` | `^2.4.0` | MF host runtime — exact-match with `../reusable-indexer/web/package.json` |

`npm audit` post-install: 0 critical, 0 high, 0 moderate, 4 low (all pre-existing jsdom transitive paths from slice 1). The package has no `preinstall`/`install`/`postinstall`/`prepare` lifecycle scripts (verified via `npm view @module-federation/enhanced scripts`). Acceptable per `web-dependency-security.md`.

---

## /shared/ additions

None. Slice 2 builds against the existing `@shared/types/indexer-host.ts` and `@shared/types/api-dtos.ts` without adding new types or constants.

---

## Architecture-doc updates

| Doc | Change |
|---|---|
| [`slice-plan.md`](slice-plan.md) | Slice 2 entry marked `Status: completed`. |
| [`README.md`](README.md) | New row linking this slice doc. |
| `jest.config.ts` `collectCoverageFrom` | Slice-2 placeholders removed from the exclusion list (`features/indexer-host/`, `hooks/useApiClient.ts`, `hooks/useUrlState.ts`, `utils/problemDetails.ts`). New exclusion for the E2E-only stub `features/indexer-host/IndexerApp.e2eStub.tsx`, mirroring the `msalInstance.e2eStub.ts` treatment. |

No changes to `module-boundaries.md`, `data-model.md`, `api-contracts.md`, `shared-types.md`, or `shared-inventory.md` — the slice followed those locked surfaces verbatim.

---

## Decisions / tradeoffs not visible from the diff

1. **Single catch-all route instead of one route per path** (bootstrap.tsx). Rendering `<AuthGate><AppShell /></AuthGate>` from both `<Route path="/c/:id">` and `<Route path="*">` would pass the same JSX expression but distinct element identities to the route table — react-router would unmount the old AppShell and mount a fresh one on every navigation, throwing away the lazy-loaded indexer chunk. Using one catch-all route plus `useMatch('/c/:documentSetId')` inside `useUrlState` keeps the shell mounted across navigations.

2. **`useReducer(reducer, arg, init)` lazy initializer** for `IndexerHostState`. The third-arg form runs `buildInitialIndexerHostState(initialStateOnMount)` once at mount; later renders never re-evaluate it. The `initialStateOnMount` itself is captured via `useRef(...).current` so the URL is read exactly once on mount — subsequent URL changes are reconciled imperatively via `IndexerHandle.selectCollection()`, matching the contract that `initialState` is a one-shot deep-link, not a reactive prop.

3. **`lastReconciledUrlIdRef`** dual-purpose ref. Tracks both directions of the URL↔indexer sync: incremented when the host pushes a URL change in response to a `collection/activated` event (so the URL effect doesn't echo back), and incremented when the URL effect fires (so a future event for the same id doesn't re-push). Without it, browser back/forward would generate duplicate history entries.

4. **Compile-time exhaustiveness guard in `eventRouter.ts`** even though the switch already covers all five variants. `web-state-management.md` mandates exhaustive switches in reducers; this dispatcher returns `void`, so a missing case would compile silently. Adding `default: { const exhaustive: never = event; throw new Error(...) }` makes adding a new `IndexerEvent` variant upstream a compile error here, consistent with `module-boundaries.md` §2.3 ("every `IndexerEvent` type must have a handler").

5. **Defense-in-depth `GET /document-sets/{id}` access check** mentioned in the slice plan and `api-contracts.md` §2.1 was *not* implemented in this slice. Rationale: the API enforces ownership server-side via 403 ProblemDetails, the indexer surfaces those failures via its own error UI, and the consuming app already treats 401s correctly via `useApiClient`. Adding a host-side pre-mount check is true defense-in-depth — flagged as a low-priority follow-up, not a security gap. Slice 3 (which is the first feature that actually needs the API client) can fold the check in if the indexer's error UX is judged insufficient.

6. **E2E-only "Trigger" buttons in `IndexerApp.e2eStub.tsx`**. Adding visible buttons for `auth/expired`, `error/unhandled`, and `collection/list-changed` is a small surface increase but keeps both the jest tests and the Playwright suite using the same component without test-only props or `data-testid`-driven shortcuts. The Playwright suite never clicks these, so they're inert in E2E runs. The stub is dead-code-eliminated in production builds (gated by `MSAL_E2E_STUB`).

7. **Custom `Response`/`Headers` shim** in `setupTests.ts`. undici was tried first but introduced persistent timers and connection pools that prevented Jest from exiting cleanly. The shim is ~50 lines, covers exactly the surface our tests use (`new Response(body, { status, headers })`, `.headers.get/.set`, `.json()`, `.text()`, `.clone()`, `.ok`, `.status`), and lets Node's event loop drain at end of test. Real fetch was never needed in tests — every fetch call is mocked.

8. **MSAL e2e stub session persistence** added so the slice-2 deep-link Playwright test (`page.goto('/c/...')`) doesn't lose auth across navigation. Real MSAL persists in sessionStorage; the stub now matches.

---

## Review outcomes

### `/code-review`
- Total findings: 3 (0 high, 1 medium, 2 low). All auto-fixed.
  - Medium: missing `never` exhaustiveness guard in `eventRouter.ts` — added `default: { const exhaustive: never = event; throw … }` so a future `IndexerEvent` variant fails to compile until handled.
  - Low: dead `buildInitialIndexerHostState` re-export from `IndexerHostContext.tsx` (no consumer imports it from here) — removed.
  - Low: `React.Ref<IndexerHandle>` in `loadIndexerApp.ts` referenced via the ambient namespace instead of an explicit `import type { Ref } from 'react'` — fixed for consistency.

### `/security-review`
- Total findings: 5 (0 critical, 0 high, 1 medium acknowledged, 3 low, 1 informational). Overall: **PASS**.
  - Medium (A05 Misconfiguration): `INDEXER_REMOTE_URL` has no scheme allowlist or production-presence guard. A misconfigured deploy could load the federation remote over plaintext HTTP or from an attacker-controlled origin (the remote runs first-party). Mitigation deferred to slice 5 alongside the CSP work — the indexer origin must be enumerated explicitly in `script-src`. Captured as an open follow-up.
  - Low (A03 URL injection): `useUrlState.pushCollection` interpolated `id` directly into `/c/${id}`. A compromised remote emitting a path-traversal id would normalize unpredictably. Defense-in-depth fix landed: `encodeURIComponent(id)`.
  - Low (A09 PII discipline): `event.messageForLogs` from the indexer is forwarded to App Insights. The host contract guarantees no PII or user content; no length cap or sanitization added — relying on the contract.
  - Low (A10 client-side SSRF): `useApiClient.raw` accepts arbitrary URLs. No caller in slice 2 passes user input as a URL; flagged for slice 3 (first real consumer of the client) to add a host allowlist matching `config.apiBaseUrl`.
  - Informational (A06): new dep `@module-federation/enhanced@^2.4.0` — npm audit clean (0 critical/high/moderate), no `preinstall`/`install`/`postinstall`/`prepare` scripts.

### Quality gates
| Gate | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npx tsc --noEmit` | 0 errors |
| `npm run test:coverage` | 132 tests pass; 94.01 % / 84.29 % / 86.71 % / 95.7 % (statements/branches/functions/lines) — above the 80 % floor |
| `npm run test:e2e` | 13/13 chromium pass. Edge project failed locally because the Edge browser binary is not installed on this machine (`Chromium distribution 'msedge' is not found`); same outcome as slice 1. CI must install Edge for the full matrix to run. |

---

## Open follow-ups

1. **`INDEXER_REMOTE_URL` production guard** — slice 5 owns it (security review §1). Need a build-time check that rejects an empty or non-`https://` URL in production mode, plus the CSP `script-src` enumeration (existing slice-1 follow-up).
2. **`useApiClient` host allowlist** — add to slice 3 when the chat feature first invokes the API client. Restricts absolute URLs to the configured `apiBaseUrl` origin so a future feature can't accidentally exfiltrate the bearer token.
3. **Defense-in-depth `GET /document-sets/{id}` pre-mount check** — optional addition for slice 3+ if the indexer's own 403 UX is judged insufficient. Not load-bearing.
4. **Production hosting decision for `INDEXER_REMOTE_URL`** — `scaffold-notes.md` §8 still flags this as open. Slice 5 (the deployment / final polish pass) is the natural place to resolve it.
5. **Edge browser in CI** — requires `npx playwright install msedge` on the runner. Not a slice-2 regression; same gap as slice 1 ran into locally.

---

## File-by-file summary (slice-2 surfaces)

```
src/
├── app-shell/
│   ├── AppShell.tsx                            ← brand <span> → <h1>; placeholder swapped for <IndexerHost>
│   └── AppShell.module.scss                    ← removed placeholder styles
├── auth/
│   ├── __mocks__/msalInstance.ts               ← +getLogger and surface needed by MsalProvider
│   └── msalInstance.e2eStub.ts                 ← +sessionStorage persistence
├── features/
│   └── indexer-host/
│       ├── IndexerHost.tsx                     ← real (replaces scaffold)
│       ├── IndexerHost.module.scss             ← new
│       ├── IndexerHost.test.tsx                ← new
│       ├── IndexerHostContext.tsx              ← new
│       ├── IndexerHostContext.test.tsx        ← new
│       ├── IndexerApp.e2eStub.tsx              ← new (Playwright + jest seam)
│       ├── eventRouter.ts                      ← new (with never exhaustiveness guard)
│       ├── eventRouter.test.ts                 ← new
│       ├── indexerHostReducer.ts               ← new
│       ├── indexerHostReducer.test.ts          ← new
│       ├── loadIndexerApp.ts                   ← new
│       ├── __mocks__/loadIndexerApp.ts         ← new (jest manual mock)
│       ├── index.ts                            ← rewired barrel
│       ├── README.md                           ← updated
│       └── (deleted) useActiveCollection.ts, useIndexerRef.ts ← superseded by IndexerHostContext
├── hooks/
│   ├── useApiClient.ts                         ← real
│   ├── useApiClient.test.tsx                   ← new
│   ├── useUrlState.ts                          ← real
│   └── useUrlState.test.tsx                    ← new
├── utils/
│   ├── problemDetails.ts                       ← real
│   └── problemDetails.test.ts                  ← new
├── bootstrap.tsx                               ← consolidated to one catch-all route
├── setupTests.ts                               ← +Headers/Response shim
└── test-utils.ts                               ← +flushIDB timeout 50 → 150ms

webpack.config.js                               ← +ModuleFederationPlugin + mfRuntime split chunk
jest.config.ts                                  ← removed slice-2 exclusions; +mws_indexer/IndexerApp moduleNameMapper
e2e/app.spec.ts                                 ← +Slice 2 describe block (5 tests)
package.json                                    ← +@module-federation/enhanced ^2.4.0
```
