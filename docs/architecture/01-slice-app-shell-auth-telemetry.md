# Slice 01 — App shell + Auth + Telemetry

> **Capability:** *"User signs in via Entra ID and lands on a themed app shell. Sign-out works. Theme toggle persists across reloads."*
> **Spec sections:** REQUIREMENTS.md §2.8, §3, §6.2, §6.3, §7
> **Slice plan entry:** [`slice-plan.md`](slice-plan.md) → "Slice 1: App shell + Auth + Telemetry"
> **Status:** Completed

This document is a snapshot of what happened during the slice. Living architecture docs (`module-boundaries.md`, `data-model.md`, etc.) are updated separately when a later slice changes the same surface.

---

## Layers changed

### Auth (`src/auth/`)
- `msalInstance.ts` — singleton `PublicClientApplication`, configured from build-time env. Token cache: `sessionStorage` (per REQUIREMENTS.md §3.5).
- `msalInstance.e2eStub.ts` — deterministic stub used only when `MSAL_E2E_STUB=true`. Production builds dead-code-eliminate the entire branch via Webpack DefinePlugin + Terser.
- `AuthContext.tsx` — owns the `AuthState` discriminated union (per `data-model.md` §2.1). Subscribes to MSAL `LOGIN_SUCCESS` / `LOGOUT_SUCCESS` events and bridges them to React state. Exposes `signIn`, `signOut`, `expireAuth` callbacks. `expireAuth` is wired here ahead of slice 2 so the indexer's `auth/expired` event handler can plug in without refactoring.
- `MsalAppProvider.tsx` — combines `<MsalProvider>` (msal-react) with `<AuthContextProvider>`.
- `AuthGate.tsx` — render gate: branded sign-in screen (single primary button, no marketing copy) for unauthenticated/expired states; pass-through for authenticated.
- `useAuth.ts`, `useAccessToken.ts`, `UserMenu.tsx` — all real implementations (no scaffolds remain).

### Theme (`src/theme/`)
- `ThemeProvider.tsx` — reads the `[data-theme]` attribute set by the inline `<script>` in `index.html` so first render matches first paint (no FOUC). `setTheme` writes both DOM and `localStorage.theme-preference`. `localStorage` failures (private mode, quota) are caught — DOM still updates.
- `useTheme.ts` — context consumer.

### Telemetry (`src/telemetry/`)
- `useTrackPageView.ts` — subscribes to react-router `useLocation`, fires `appInsights.trackPageView` with `pathname` only (query strings stripped, per `web-error-logging.md`).

### App shell (`src/app-shell/`)
- `AppShell.tsx` — page chrome: skip-link, header (brand, theme toggle with `aria-pressed`, user menu), main canvas placeholder. Slice 2/3/4 fill in indexer canvas and the chat/viewer panel slots.
- `layoutReducer.ts` + `useLayoutState.ts` — reducer for chat/viewer panel state, persisted via the consolidated `consuming-app:layout` IDB key. `viewerPanel.open` is filtered back to `false` post-hydrate (transient field per `data-model.md` §2.5).

### Routing (`src/bootstrap.tsx`)
- Provider chain: `<MsalAppProvider>` → `<ThemeProvider>` → `<BrowserRouter>` → `<Routes>`.
- Routes:
  - `/health` — un-gated `<HealthPage>` (intentional, per `scaffold-notes.md` §3).
  - `/c/:documentSetId` — `<AuthGate><AppShell /></AuthGate>` (slice 2 reads the param).
  - `*` — catch-all → `<AuthGate><AppShell /></AuthGate>`.

### Shared utilities (real implementations)
- `src/utils/idb.ts` — async wrapper over the IndexedDB API. Single object store, single DB, error-swallowing on every operation (returns `null` / no-op when storage is unavailable).
- `src/hooks/usePersistedReducer.ts` — IDB-backed reducer. Hydrates on mount via private `__persistedReducer/rehydrate` action; persists on every change debounced 250 ms. `initialState` captured at mount so re-render identity changes don't clobber edits.

### Tests
- 18 jest suites, **85 tests passing**, 92.91% statements / 86.6% branches / 84.53% functions / 95.23% lines.
- `jest.config.ts` `collectCoverageFrom` updated to exclude slice-2/3/4 placeholder modules — each future slice removes its entries (per `scaffold-notes.md` §4).
- `e2e/app.spec.ts` — replaces template tests with the slice-1 critical path: sign-in screen → sign-in (via stub) → app shell → theme toggle → reload → theme persists → sign-out → sign-in screen. Plus `/health` reachability and three axe sweeps (sign-in screen, signed-in light, signed-in dark).
- `playwright.config.ts` — `webServer.env` injects `MSAL_E2E_STUB=true` plus dummy MSAL/API/indexer URLs needed for the bundle to compile.

### Build configuration
- `webpack.config.js` — added `MSAL_E2E_STUB` to the DefinePlugin allowlist.
- `src/setupTests.ts` — added `TextEncoder` / `TextDecoder` polyfills (jest 29 / jsdom 20 don't expose them; react-router-dom 7 uses them at module load).

### Dependencies installed
| Package | Version | Reason |
|---|---|---|
| `@azure/msal-browser` | ^5.9.0 | MSAL `PublicClientApplication` |
| `@azure/msal-react` | ^5.3.2 | `<MsalProvider>` + React 19 peer support |
| `react-router-dom` | ^7.15.0 | App routes (`/`, `/c/:id`, `/health`) |

`npm audit` after install: 0 critical, 0 high, 0 moderate, 4 low — all in pre-existing jsdom dev-only transitive paths. Acceptable per `web-dependency-security.md`. None of the three direct deps ship `preinstall`/`install`/`postinstall`/`prepare` hooks (verified).

---

## /shared/ additions

| Symbol | File | Consumers (now → future) |
|---|---|---|
| `LAYOUT_STORAGE_KEY` | [`shared/types/layout.ts`](../../shared/types/layout.ts) | app-shell (used now) |
| `V1_CHAT_LLM_PROVIDER` | [`shared/types/chat.ts`](../../shared/types/chat.ts) | features/chat (slice 3 — added now to lock the value before slice 3 builds against it) |

`PERSISTENCE_KEYS` (the per-field map originally sketched) was **removed** in favor of the single `LAYOUT_STORAGE_KEY`. See "Architecture-doc updates" below.

---

## Architecture-doc updates

| Doc | Change |
|---|---|
| [`data-model.md`](data-model.md) §2.5 + §3 | Replaced the three per-field IDB keys (`...chat-panel-width`, `...viewer-panel-width`, `...chat-panel-open`) with one consolidated `consuming-app:layout` key. One reducer = one atomic write = one read on hydrate. Rationale documented inline. |
| `REQUIREMENTS.md` §4.9 + §10 | Replaced two-option model picker (Balanced/Powerful) with a single hardcoded `llmProvider: 'Claude'` (resolves to Claude Opus 4.7 server-side per discussion in slice 1 chat). Picker UI deferred — see deferred list. (User-driven scope reduction, not a slice-1 implementation choice.) |
| `api-contracts.md` §2.3 | SSE body shape pinned to `{ content, llmProvider: 'Claude' }`. |
| `module-boundaries.md` §2.4 | Removed "Model picker" from chat-feature "Owns" list. |
| `slice-plan.md` Slice 3 | Dropped picker scope/tests/dropdown-axe-state; added send-body assertion. Spec mapping updated. |
| `shared-types.md`, `shared-inventory.md` | Reflected the chat-types and Pill-consumer changes. |
| `jest.config.ts` `collectCoverageFrom` | Added a comment block listing which slice re-adds each excluded path. |

---

## Decisions / tradeoffs not visible from the diff

1. **Sign-in screen design** (open question from `scaffold-notes.md` §8) — shipped a minimal branded card: app title in `--font-mix`, single primary CTA per `web-branding.md` button spec. No marketing copy. Product can replace later without disturbing AuthContext / MSAL wiring.

2. **MSAL e2e seam via dead-code-eliminated stub** rather than build-time alias resolution. Reasons: (a) keeps webpack config simple, (b) the stub file's existence in the source tree is more discoverable than an aliased path, (c) Terser drops it deterministically when `MSAL_E2E_STUB === ''`. The cost is one extra file under version control. Documented at the top of `msalInstance.ts`.

3. **Layout state consolidation** (one IDB key vs. three per-field keys). Atomic write on each dispatch, single read on hydrate, simpler reducer surface. The trade-off is that any change to `LayoutState`'s shape requires a rehydrate-time merge (we already have `{ ...initialState, ...stored }`) — covered.

4. **`useLayoutState` post-hydrate effect** that resets `viewerPanel.open` is technically a "derived state in effect" smell flagged by `web-component-architecture.md`. The pragmatic justification: `usePersistedReducer` doesn't expose a hydration callback, the field-reset is a one-time post-hydrate cleanup, and there's no oscillation risk because the reducer fixes the field after the first dispatch. Documented in the file's header. If `usePersistedReducer` ever grows a hydration-success callback, fold this into it.

5. **Probe components in tests use `useContext(AuthContext)` directly** rather than `useAuth()` — intentional, so the test asserts on the context binding itself (not just the hook surface).

6. **`expireAuth` exposed now, wired in slice 2.** AuthContext exposes the callback so slice 2's indexer-event handler can call it without a context-shape change.

7. **`/health` route is publicly reachable** by design (per `scaffold-notes.md` §3). Sensitive values masked. Flagged in security review as Low / acknowledged.

---

## Review outcomes

### `/code-review`
- Total findings: 3 (0 high, 2 medium, 1 low). All auto-fixed.
  - Import ordering in `src/auth/AuthContext.tsx` and `src/app-shell/useLayoutState.ts` (alias before relative).
  - Missing inline justification on the `as MsalAccountInfo` cast in `AuthContext.tsx` — added a comment explaining the runtime narrowing.

### `/security-review`
- Total findings: 3 (0 critical, 0 high, 1 medium acknowledged, 2 low). Overall: **PASS**.
  - Medium: missing CSP meta tag on `index.html` — deferred to slice 5 (final polish + security pass) when the full origin allowlist is known. Tracked in slice 5 scope.
  - Low: `/health` reachable without auth (intentional, masked values).
  - Low: `{ ...stored }` spread in `usePersistedReducer` — defense-in-depth concern around prototype pollution; data is data we wrote, no realistic attack surface.

### Quality gates
| Gate | Result |
|---|---|
| `npm run lint` | 0 errors |
| `npx tsc --noEmit` | 0 errors |
| `npm run test:coverage` | 85 tests pass; 92.91% / 86.6% / 84.53% / 95.23% (statements/branches/functions/lines) — all above the 80% floor for slice-1 surfaces |
| `npm run test:e2e` (chromium) | 8/8 pass |

---

## Open follow-ups

1. **CSP** — slice 5 owns it (security review §1). Need to enumerate every origin (Entra `login.microsoftonline.com`, `API_BASE_URL`, `INDEXER_REMOTE_URL`, App Insights ingestion). Inline theme-init `<script>` will need a hash or `'unsafe-inline'`.
2. **Indexer `auth/expired` → `expireAuth()` wiring** — slice 2 plugs the indexer event into `useAuth().expireAuth()`. The callback already exists.
3. **`useLayoutState` post-hydrate effect** — re-fold into `usePersistedReducer` if/when that hook grows a hydration callback. Low priority.
4. **The four pre-existing `low` jsdom transitive vulns** — monitor `npm audit`; fix on next jest/jsdom major bump.

---

## File-by-file summary (slice-1 surfaces)

```
src/
├── app-shell/
│   ├── AppShell.tsx                  ← real (replaces scaffold)
│   ├── AppShell.module.scss          ← new
│   ├── AppShell.test.tsx             ← rewritten
│   ├── layoutReducer.ts              ← new
│   ├── layoutReducer.test.ts         ← new
│   ├── useLayoutState.ts             ← new
│   └── useLayoutState.test.tsx       ← new
├── auth/
│   ├── AuthContext.tsx               ← new
│   ├── AuthContext.test.tsx          ← new
│   ├── AuthGate.tsx                  ← real
│   ├── AuthGate.module.scss          ← new
│   ├── AuthGate.test.tsx             ← new
│   ├── MsalAppProvider.tsx           ← real
│   ├── MsalAppProvider.test.tsx      ← new
│   ├── UserMenu.tsx                  ← real
│   ├── UserMenu.module.scss          ← new
│   ├── UserMenu.test.tsx             ← new
│   ├── msalInstance.ts               ← new (real PublicClientApplication)
│   ├── msalInstance.e2eStub.ts       ← new (Playwright seam)
│   ├── msalInstance.test.ts          ← new
│   ├── useAccessToken.ts             ← real
│   ├── useAccessToken.test.tsx       ← new
│   ├── useAuth.ts                    ← real
│   ├── useAuth.test.tsx              ← new
│   └── __mocks__/msalInstance.ts     ← new (jest manual mock)
├── theme/
│   ├── ThemeProvider.tsx             ← real
│   ├── ThemeProvider.test.tsx        ← new
│   └── useTheme.ts                   ← real
├── telemetry/
│   ├── useTrackPageView.ts           ← real
│   └── useTrackPageView.test.tsx     ← new
├── hooks/
│   ├── usePersistedReducer.ts        ← real
│   └── usePersistedReducer.test.tsx  ← new
├── utils/
│   ├── idb.ts                        ← real
│   └── idb.test.ts                   ← new
├── appInsights.test.ts               ← new
├── bootstrap.tsx                     ← rewritten (provider chain + routes)
└── setupTests.ts                     ← +TextEncoder polyfill

shared/types/
├── chat.ts                           ← model-picker types removed; V1_CHAT_LLM_PROVIDER added
├── layout.ts                         ← PERSISTENCE_KEYS removed; LAYOUT_STORAGE_KEY added
└── README.md                         ← helper-list updated

webpack.config.js                     ← +MSAL_E2E_STUB define
playwright.config.ts                  ← +webServer.env (e2e build flags)
jest.config.ts                        ← +slice-2/3/4 coverage exclusions (with re-add notes)
e2e/app.spec.ts                       ← rewritten for slice-1 flows
```
