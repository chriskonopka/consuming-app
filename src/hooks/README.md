# `hooks/`

## What belongs here

Shared custom hooks used by 2+ features:

- `useApiClient()` — typed fetch wrapper (auth, problemDetails, retry-on-401)
- `usePersistedReducer()` — IndexedDB-backed reducer
- `useAbortable()` — AbortController-backed async wrapper
- `useDebouncedValue()` — value debounce
- `useUrlState()` — push/parse `/c/{id}` URL shape

Per `web-component-architecture.md` and `web-file-structure.md`: hooks names start with `use`, return an object (with a named return-type interface) when they expose more than one value, and have colocated `.test.ts` files. **No barrel `index.ts`** — import each hook directly.

## What does not belong here

- Feature-local hooks (`useChatSession`, `useViewer`, `useCitationClick`, `useIndexerRef`, `useActiveCollection`, `useAuth`, `useAccessToken`, `useTheme`, `useTrackPageView`) — those live in their feature/module folders.
- Anything with side effects on import — hooks are values produced by being called.
- Direct `indexedDB` access — go through `utils/idb.ts` so the lock-down stays in one place per `web-persistence.md`.

## Status

Scaffolded — `usePersistedReducer` lands in slice 1, `useApiClient` and `useUrlState` in slice 2, `useAbortable` and `useDebouncedValue` in slice 3.
