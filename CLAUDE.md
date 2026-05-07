# Engineering Standards — Consuming App

> **Project:** Frontend host that loads the reusable indexer (`mws_indexer/IndexerApp`) via Module Federation and adds the chat / citation / document-viewer experience on top.
> **Spec:** [`REQUIREMENTS.md`](REQUIREMENTS.md). Read it first.
> **Sibling project:** [`../reusable-indexer/`](../reusable-indexer/) — the MF remote. Its `shared/types/host-contract.ts` is the locked surface this app integrates against.

This app is a single web frontend — no API, no database, no monorepo. The standards below are adapted from the indexer's parallel CLAUDE.md, scoped down to the web layer plus the consuming-app-specific concerns (Module Federation host, MSAL, SSE chat client, PDF viewer).

---

## MANDATORY — Before Planning or Writing Any Code

Before planning or implementing any feature, you MUST:

1. Identify every `.claude/rules/` file that governs the feature area using the table below
2. Read each of those files in full using the Read tool
3. State which rules you read and list the key constraints they impose
4. Read `.claude/rules/slicing.md` to confirm the planned slice scope is right-sized — once per feature, not once per slice

This applies to planning, design, and architecture — not just implementation. Rules contain implementation constraints that shape design decisions; you cannot plan correctly without knowing them. Read once per feature, not once per phase.

Do not write a single line of implementation code — or propose an implementation plan — before completing these steps.

**Do not invent constraints.** If a limit, threshold, timeout, or behaviour is not stated in a rule file or in `REQUIREMENTS.md`, it does not exist. Do not add it. If you are unsure, ask.

| Feature area | Rule files to read before implementing |
|---|---|
| Components | `web-component-architecture.md`, `web-coding-standards.md`, `web-styling.md` |
| State management | `web-state-management.md` |
| Testing | `web-testing.md`, `web-accessibility.md` |
| File / folder structure | `web-file-structure.md` |
| Styling / theming | `web-styling.md`, `web-branding.md` |
| Accessibility | `web-accessibility.md` |
| Performance | `web-performance.md` |
| Error logging | `web-error-logging.md` |
| Persistence (IndexedDB / localStorage) | `web-persistence.md` |
| Linting / formatting | `web-linting-formatting.md` |
| Browser support | `web-browser-support.md` |
| Dependency additions | `web-dependency-security.md` |
| Module Federation host | `web-component-architecture.md`, `web-performance.md`, `REQUIREMENTS.md` §2 |
| MSAL / Entra auth | `web-coding-standards.md`, `web-persistence.md` (token storage), `REQUIREMENTS.md` §3 |
| Chat SSE client | `web-coding-standards.md`, `web-state-management.md`, `REQUIREMENTS.md` §4 |
| Citations & PDF viewer | `web-component-architecture.md`, `web-styling.md`, `REQUIREMENTS.md` §5 |

The bottom four rows reference `REQUIREMENTS.md` because consuming-app-specific concerns aren't covered by a dedicated rule file yet. If repeated patterns emerge during build, lift them into a new `web-*.md` rule file before they drift.

---

## Sub-Agent Orchestration

Sub-agents are not the default — for slices that fit in a single context, prefer single-agent execution. When you do dispatch a sub-agent, the orchestrator owns the compliance contract. The sub-agent only sees what you pass it: its starting prompt is the rules it has.

**Orchestrator obligations when dispatching a sub-agent:**

1. **Pass the relevant rule excerpts in the prompt.** Sub-agents do not inherit `CLAUDE.md` or any `.claude/rules/` file. Identify the rules that govern the sub-agent's scope and quote the binding constraints into its prompt — do not assume it will go find them.
2. **State the applicable completion gates and skills.** Tell the sub-agent which `/code-review`, `/security-review`, `/commit`, or area-specific skills its work must run through, and which gates (`npm run lint`, `npx tsc --noEmit`, `npm run test:coverage`, `npm run test:e2e`) must pass before it returns.
3. **Verify the output independently before accepting.** When the sub-agent reports back, read the files it changed, run the relevant gates yourself, and check the output against the rules you passed in. Do not accept the sub-agent's self-reported completion status as proof. If verification fails, re-task the sub-agent with the specific deficiencies.
4. **A task is not complete until every applicable gate passes** — at any level of the agent hierarchy. Partial completion is not completion.

---

## Execution Discipline

- **If the scope is too large, say so — do not cut silently.** State explicitly what you are skipping and why. A known gap the user can plan around is better than a silent omission.
- **Default to confirming before destructive, large-scope, or network-affecting actions.** Pause and ask before anything irreversible or shared-state (`rm -rf`, force-push, `reset --hard`, deploying, pushing, opening or merging PRs, posting to external services).

---

## Architectural Decision Authority

Orchestrators and sub-agents make routine architectural decisions on their own. Follow `.claude/rules/`, use judgment, and note non-obvious choices briefly so the user can redirect.

**Decide and proceed:** local, low-impact choices that follow existing conventions and stay contained to a small area of the codebase.

**Stop and ask:** decisions that introduce new patterns, dependencies, or abstractions; cross-cutting concerns; affect shared contracts or schemas; span multiple areas; touch security, capacity, or scaling; or would change the rules themselves.

**Always stop and ask** for any change that affects the host contract surface (`../reusable-indexer/shared/types/host-contract.ts`). The contract is co-owned; this app cannot evolve it unilaterally.

Rule of thumb: if it's reversible quickly and locally, decide. If reversing it would ripple across the codebase, ask first — present 2–3 options with tradeoffs.

---

## Pre-Implementation Checklist

State which tiers this slice touches in one line before walking the checklist, e.g. *"Tiers: Always, Web component, MF host."* This makes the scope visible and prevents silently skipping a tier that should apply.

| Tier | Trigger | Items |
|---|---|---|
| **Always** | every slice | Every limit/threshold/timeout/count comes from a rule file or `REQUIREMENTS.md` (none invented). Tests ship in this slice — never deferred. |
| **Code** | any executable code | User content, AI responses, document content, and PII are never logged. `AbortController` is wired through every `fetch` call that lives longer than the component (chat SSE, status polls, document streams). |
| **Web component** | adding/changing a React component | Colocated `.test.tsx` exists with `jest-axe` assertions across each meaningfully different rendered state (loading, error, disabled, open/closed, etc.) — not just default render. 80% coverage from real-behavior tests, not snapshots or `istanbul ignore`. |
| **Web hook** | adding a hook that manages state transitions | Unit tests cover all dispatch actions and edge cases. |
| **MF host integration** | adding/changing the indexer mount, props, or event handlers | Indexer props are typed via `import type … from 'mws_indexer/types'`. Lazy-loaded via `React.lazy` + `Suspense`. Singletons in `shared` config match indexer's React/React-DOM versions exactly. Every `IndexerEvent` type has a handler — no silent drops. |
| **MSAL / auth** | touching MSAL config, token acquisition, or login flow | Tokens never written to `localStorage` or IndexedDB. `acquireTokenSilent` is tried first, falling back to `acquireTokenPopup` on `InteractionRequiredAuthError`. The same `getAccessToken` is passed to the indexer and used for direct API fetches — never two different functions returning two different tokens. |
| **Chat SSE client** | adding/changing the streaming client | `fetch` + `ReadableStream` reader, never `EventSource`. `AbortController` cancels mid-stream cleanly. `error` events surface as user-visible non-blocking notices; pre-stream `ProblemDetails` errors map to UI text via `detail`. Token order is preserved — never re-ordered. |
| **PDF viewer / citation overlay** | adding/changing PDF rendering or citation highlights | Drift guard rejects highlights covering > 25% of visible page height. "Couldn't locate this quote" fallback fires when the drift guard rejects. Highlight color uses `color-mix()` with `--color-warning` — never hardcoded `rgba`. Citation coordinates from the API are PDF points; multiplied by render-scale factor before drawing. |

Tiers omit anything outside the slice.

---

## Capacity and Scalability

This app is a frontend host — it does not own backend capacity. Inherits the indexer/API project's default peak of **500 concurrent users** (declared in `../reusable-indexer/CLAUDE.md`). Frontend impact: bundle size, MF chunk loading patterns, App Insights telemetry volume.

- The MF remote (`mws_indexer/remoteEntry.js`) is fetched once per session and cached. Do not refetch on collection switch.
- App Insights `trackEvent` / `trackException` calls run async — they do not block render. But avoid emitting per-token telemetry from chat (would multiply event volume by message length).

---

## Project Layout

This is a single web app — no monorepo subfolders.

```
test-app/
├── REQUIREMENTS.md          # Spec — source of truth for features
├── CLAUDE.md                # This file
├── .claude/
│   ├── rules/               # Web rules (15 files) — read on demand
│   ├── hooks/               # PreToolUse hooks (block-git-commit, check-test-coverage)
│   ├── skills/              # /commit, /ship, build-* workflow, web-* scaffolds
│   └── settings.json
├── package.json
├── webpack.config.js        # MF host config
├── tsconfig.json / .app.json / .test.json / .node.json
├── jest.config.ts
├── playwright.config.ts
├── eslint.config.mjs
├── .prettierrc
├── index.html
├── src/                     # Application source
│   ├── main.tsx             # Entry — async imports bootstrap.tsx
│   ├── bootstrap.tsx        # MF async boundary
│   ├── auth/                # MSAL config, getAccessToken
│   ├── features/            # Vertical-slice modules (chat, viewer, citations, indexer-host)
│   ├── components/          # Shared UI (header, panels, splitter)
│   ├── hooks/               # Shared hooks
│   ├── utils/               # Pure utilities
│   ├── styles/              # Global styles, design tokens
│   ├── types/               # Shared TS types
│   ├── theme/               # Theme tokens / dark-light setup
│   ├── appInsights.ts       # App Insights init (singleton)
│   └── setupTests.ts        # Jest polyfills
└── e2e/                     # Playwright tests
```

The indexer project is at `../reusable-indexer/` and provides:
- `mws_indexer/IndexerApp` — the React component to mount
- `mws_indexer/types` — type re-exports for props, events, ref handle

These are loaded at runtime via Module Federation. Type-imports are erased at compile time.

---

## Quality Gates

A task is not complete until all four gates pass:

1. `npm run lint` — zero ESLint errors
2. `npx tsc --noEmit` — zero TypeScript errors
3. `npm run test:coverage` — all Jest tests pass and provide at least **80%** coverage. **80% is a hard floor, not aspirational.** Coverage must come from tests that exercise real behavior (branches, error paths, state transitions, user interactions). Trivial snapshot tests, render-only assertions, and `/* istanbul ignore */` comments used to clear the gate are not acceptable.
4. `npm run test:e2e` — all Playwright tests pass

All commits go through a review gate. Direct `git commit` is blocked by a PreToolUse hook.

| Command            | Purpose                                                                              |
| ------------------ | ------------------------------------------------------------------------------------ |
| `/commit`          | Stage, review, and commit. Runs `/code-review` and `/security-review` automatically. |
| `/ship`            | Full workflow: `/commit` + push + create PR. Stops at PR creation (no merge).        |
| `/code-review`     | Run a code review independently (without committing).                                |
| `/security-review` | Run a security review independently (without committing).                            |
| `/remediation`     | Fix issues found by reviews or external scanners (GitLeaks, SonarQube, Dependabot).  |

---

## Build Workflow

The same three-step workflow as the indexer:

1. **`/build-architecture`** (Step 1) — produces `/docs/architecture/` and `/shared/types/` from `REQUIREMENTS.md`. Includes a slice plan. Stops at the architecture review gate. **No code.**
2. **`/build-scaffold`** (Step 2) — scaffolds project skeleton from architecture (config, dirs, MSAL bootstrap, MF webpack config, `/shared/`, app-shell skeleton). **No feature logic.** Stops at the scaffold review gate.
3. **`/build-application`** (Step 3) — implements the locked slice plan one slice at a time, in order, pausing for human confirmation between each slice. Auto-picks the first unstarted slice.

Web-specific scaffolding skills (`/web-create-component`, `/web-create-feature`, `/web-add-tests`, `/web-add-e2e`) are used inside Step 3.

---

## Frontend Standards Reference

Inherited from the indexer's `web/CLAUDE.md`:

- **React 19**, **TypeScript** (no `any` without justification), **Webpack 5 + Babel**, **Jest**, **jest-axe**, **Playwright**.
- **No `@ts-ignore` / `@ts-expect-error`** without a documented justification.
- **No commented-out code**, no `TODO` without a linked issue, no magic numbers, no `console.log`.
- **No direct DOM manipulation** — use refs.
- **Avoid `useEffect`** for things derivable from state or handled by event handlers.
- **`jest-axe`** is required across each meaningfully different rendered state, not just default render.

Consuming-app-specific additions:

- **React + React-DOM versions must match the indexer's exactly.** Mismatched singletons in MF break the shared scope and cause runtime errors.
- **`@module-federation/enhanced` version must match the indexer's** for the same reason.
- **`pdfjs-dist` version pinning** — pin to an exact version (`--save-exact`); pdf.js's worker contract changes between versions.
- **MSAL configuration is read-once at app boot.** Do not mutate `PublicClientApplication` after init.

---

## Cross-references

- `REQUIREMENTS.md` — feature spec and acceptance criteria.
- `../reusable-indexer/shared/types/host-contract.ts` — the locked MF surface this app integrates against. Read before touching anything in `src/features/indexer-host/`.
- `../reusable-indexer/docs/architecture/module-boundaries.md` — explains what the indexer ships vs. what the consuming app must build.
- `../reusable-indexer/frontend-api-contract.md` — every endpoint this app calls (chat SSE, conversations, document content stream).
