# `telemetry/`

## What belongs here

The App Insights singleton (initialized in `src/appInsights.ts`), the React `<ErrorBoundary>`, and `useTrackPageView()`. This module is the canonical entry point for everything telemetry — other modules import from here, never directly from `appInsights.ts` or the `@microsoft/applicationinsights-web` package.

The connection string is read from `APPLICATIONINSIGHTS_CONNECTION_STRING` (per `web-error-logging.md` — safe to expose in browser, write-only ingestion key).

## What does not belong here

- User content, AI responses, or document text in any tracked event or property (per PII rules).
- Per-token telemetry from chat (would multiply event volume by message length — see `module-boundaries.md` §2.10).
- Auth tokens, account emails/usernames in event properties — only `homeAccountId` (the pseudonymous Entra `sub`).

## Status

Scaffolded — `<ErrorBoundary>` already implemented (template-provided). `useTrackPageView` lands in slice 1 once routing exists.
