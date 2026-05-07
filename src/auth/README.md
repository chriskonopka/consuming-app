# `auth/`

## What belongs here

MSAL configuration and the React surface around it: `MsalAppProvider` (configures `PublicClientApplication`), `AuthGate` (renders sign-in vs authenticated), `UserMenu` (sign-out UI), `useAuth()` (state subscription), and `useAccessToken()` — the **canonical** token-acquisition function that is shared between the consuming app and the embedded indexer (see `module-boundaries.md` §3.1).

Tokens are stored only in MSAL's default `sessionStorage` (per `web-persistence.md`). Never write tokens elsewhere.

## What does not belong here

- API calls — those go through `useApiClient()` in `hooks/`.
- URL routing — owned by `app-shell/` and `hooks/useUrlState.ts`.
- Any storage of access tokens outside MSAL.
- A separate token-acquisition function for the indexer — the one returned by `useAccessToken()` is passed directly to `<IndexerApp getAccessToken={...} />`.

## Status

Scaffolded — implementation lands in slice 1.
