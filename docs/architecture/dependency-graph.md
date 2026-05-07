# Dependency Graph

Module → module dependencies. Must remain acyclic. Enforced at review and (where ESLint can prove it) at lint time via `import/no-cycle`.

---

## 1. Graph

```
                       ┌─────────────────┐
                       │  shared/types   │  (no runtime — pure types)
                       └─────────────────┘
                                ▲
        ┌───────────────────────┼───────────────────────────────┐
        │                       │                               │
        │                ┌──────┴───────┐                       │
        │                │  utils       │  (pure functions)     │
        │                └──────────────┘                       │
        │                       ▲                               │
        │                       │                               │
        │                ┌──────┴───────┐                       │
        │                │  hooks       │                       │
        │                └──────────────┘                       │
        │                       ▲                               │
        │                       │                               │
        ▼                       │                               ▼
┌─────────────────┐    ┌────────┴────────┐    ┌─────────────────────────┐
│ telemetry       │    │  components     │    │  theme                  │
│ (appInsights.ts │    │ (Splitter,      │    │ (ThemeProvider,         │
│  + ErrorBoundary│    │  Panel, Pill,   │    │  inline init script)    │
│  + trackPageView│    │  Tooltip, ...)  │    │                         │
└─────────────────┘    └─────────────────┘    └─────────────────────────┘
        ▲                       ▲                          ▲
        │                       │                          │
        │                       │                          │
        │              ┌────────┴────────┐                 │
        │              │  auth           │                 │
        │              │ (MSAL, login,   │                 │
        │              │  getAccessToken)│                 │
        │              └─────────────────┘                 │
        │                       ▲                          │
        │                       │                          │
        │              ┌────────┴────────┐                 │
        │              │  features/      │                 │
        │              │  indexer-host   │                 │
        │              └─────────────────┘                 │
        │                       ▲                          │
        │              ┌────────┼─────────┐                │
        │              │        │         │                │
        │     ┌────────┴───┐ ┌──┴──────┐ ┌┴──────────┐    │
        └─────┤ chat       │ │ viewer  │ │ citations │    │
              └─────┬──────┘ └─────┬───┘ └─────┬─────┘    │
                    │              │           │           │
                    │              │           │           │
                    └──────┬───────┴───────────┘           │
                           │                               │
                    ┌──────┴───────────────────────────────┘
                    │  app-shell (header, layout, routing root)
                    └─────────────────────────────────────────
                                       │
                                       ▼
                                 main → bootstrap
```

---

## 2. Edge list (directed: `consumer → producer`)

| From | To | Reason |
|---|---|---|
| `main.tsx` | `bootstrap.tsx` | MF async boundary |
| `bootstrap.tsx` | `app-shell` | Mounts the root |
| `app-shell` | `auth` | Wraps root in `<AuthGate>` |
| `app-shell` | `theme` | Wraps root in `<ThemeProvider>` |
| `app-shell` | `telemetry` | `<ErrorBoundary>` + `useTrackPageView()` |
| `app-shell` | `features/indexer-host` | Renders `<IndexerHost>` as main canvas |
| `app-shell` | `features/chat` | Renders `<ChatPanel>` as side panel |
| `app-shell` | `features/viewer` | Renders `<DocumentViewer>` as side panel |
| `app-shell` | `components` | Splitter, IconButton, header chrome |
| `app-shell` | `hooks` | `usePersistedReducer` for panel sizes |
| `features/chat` | `auth` | `useAccessToken()` for SSE Authorization |
| `features/chat` | `features/citations` | `<CitationMarker>` and `<SourceList>` |
| `features/chat` | `features/viewer` | Citation/source-list click → `useViewer().open(...)` |
| `features/chat` | `features/indexer-host` | `useIndexerRef()` for `revealDocument(id)` after citation click |
| `features/chat` | `hooks` | `useApiClient` for conversation CRUD; `useAbortable` for SSE |
| `features/chat` | `components` | `Panel`, `IconButton`, `LoadingSpinner` |
| `features/chat` | `utils` | `parseSse` for SSE stream parsing |
| `features/chat` | `telemetry` | trackException for stream errors |
| `features/citations` | (no module deps; pure UI + types) | — |
| `features/viewer` | `auth` | `useAccessToken()` for `GET /documents/{id}/content` (pdf.js loader, image blob fetch) |
| `features/viewer` | `hooks` | `useApiClient` |
| `features/viewer` | `components` | `Panel`, `IconButton`, `LoadingSpinner` |
| `features/viewer` | `utils` | `driftGuard`, `bytesToBlobUrl` |
| `features/viewer` | `telemetry` | trackException for render failures |
| `features/indexer-host` | `auth` | Pass `getAccessToken` to `<IndexerApp>` |
| `features/indexer-host` | `telemetry` | Pass `appInsights` to `<IndexerApp>`; handle `error/unhandled` |
| `features/indexer-host` | `theme` | Pass `initialTheme` to `<IndexerApp>` |
| `features/indexer-host` | `hooks` | `useUrlState` for routing |
| `auth` | `telemetry` | `trackEvent` on login/logout, `trackException` on auth failures |
| `auth` | `hooks` | (none — MSAL is the dep) |
| `theme` | (no module deps) | — |
| `telemetry` | (no module deps; only `@microsoft/applicationinsights-web`) | — |
| `hooks` | `auth` (only `useApiClient` → `useAccessToken`) | — |
| `hooks` | `utils` (only `useApiClient` → `problemDetails`) | — |
| `hooks` | `shared/types` | type-only |
| `components` | `shared/types` | type-only |
| `utils` | `shared/types` | type-only |

All non-trivial modules also depend on `shared/types` (type-only, erased at compile time).

---

## 3. Acyclic check

Walk every edge from `app-shell`:

- `app-shell → features/chat → features/viewer → auth → telemetry → ∅` ✓
- `app-shell → features/chat → features/citations → ∅` ✓
- `app-shell → features/chat → features/indexer-host → auth → telemetry → ∅` ✓
- `app-shell → features/viewer → auth → telemetry → ∅` ✓
- `app-shell → features/indexer-host → auth → telemetry → ∅` ✓
- `app-shell → auth → telemetry → ∅` ✓
- `app-shell → theme → ∅` ✓

No back-edges. Acyclic.

The one edge that warrants attention is `features/chat → features/viewer` (citation click opens the viewer). The reverse edge — `features/viewer → features/chat` — does **not** exist; the viewer doesn't know which message it was opened from. Future temptation to add a "back to source message" link from the viewer would create a cycle. Resolve via an `app-shell`-owned coordinator (move open-viewer state up one level), not by adding the edge.

---

## 4. External dependencies

**Runtime (added during scaffold):**

| Dep | Module | Reason |
|---|---|---|
| `react`, `react-dom` (^19.2.4 — match indexer) | all | UI |
| `@module-federation/enhanced` (match indexer) | `features/indexer-host` | MF host runtime |
| `@azure/msal-browser`, `@azure/msal-react` | `auth` | Entra ID auth |
| `@tanstack/react-query` (^5 — match indexer where applicable) | `features/chat`, `features/viewer`, `features/indexer-host` | Server state |
| `@phosphor-icons/react` (regular weight) | `components`, all features | Icons (matches indexer's `web-branding.md`) |
| `@microsoft/applicationinsights-web` | `telemetry` | Already in template |
| `pdfjs-dist` (pinned exact via --save-exact) | `features/viewer` | PDF rendering |
| `react-router-dom` (^7) | `app-shell`, `features/indexer-host` | URL routing for `/c/{id}` |

`@microsoft/applicationinsights-react-js` is **deferred** — react-router doesn't need it for v1; the manual `useTrackPageView()` hook is enough.

**Dev (already in template):**
Jest, React Testing Library, jest-axe, Playwright, ESLint, Prettier, TypeScript.
