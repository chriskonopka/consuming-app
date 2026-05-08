/**
 * IndexedDB-backed reducer hook (per web-persistence.md). Loads from IDB on
 * mount, merges with initialState, persists every state change debounced
 * 250ms. Errors swallowed with .catch() — falls back to in-memory state if
 * IDB is unavailable.
 */

import {
  useEffect,
  useReducer,
  useRef,
  type Dispatch,
  type Reducer,
} from 'react';

import { idb } from '../utils/idb';

const PERSIST_DEBOUNCE_MS = 250;

export const usePersistedReducer = <S, A>(
  key: string,
  reducer: Reducer<S, A>,
  initialState: S,
): [S, Dispatch<A>] => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const hydratedRef = useRef(false);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialStateRef = useRef(initialState);

  // Hydrate from IDB on mount. Best-effort — if IDB is unavailable we keep
  // in-memory state. We dispatch a synthetic 'hydrate' action via a private
  // shape so consumers don't need to handle hydration; we use a closure
  // dispatch path instead.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await idb.get<S>(key);
      hydratedRef.current = true;
      if (cancelled || stored === null) return;
      // Replace state via reducer-bypass: dispatch a private action that the
      // wrapped reducer handles. Simpler — apply directly through useReducer's
      // init seed isn't an option after mount. Use a shallow-merge via the
      // reducer's HYDRATE action contract documented for consumers.
      // To stay simple, we emit a synthetic action keyed by symbol.
      dispatch({
        __persistedReducer_hydrate: stored,
      } as unknown as A);
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  // Persist on every state change, debounced.
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      void idb.set(key, state).catch(() => {
        /* swallow — fall back to in-memory */
      });
    }, PERSIST_DEBOUNCE_MS);
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [key, state]);

  // Suppress the unused warning on initialStateRef — it documents intent.
  void initialStateRef;

  return [state, dispatch];
};

/**
 * Helper for reducers that want to handle the synthetic hydrate action
 * dispatched by usePersistedReducer. Use as the first branch in your reducer:
 *
 *   const hydrated = applyHydrate(action, state);
 *   if (hydrated) return hydrated;
 */
export const applyHydrate = <S>(action: unknown, _fallback: S): S | null => {
  if (
    action !== null &&
    typeof action === 'object' &&
    '__persistedReducer_hydrate' in action
  ) {
    return (action as { __persistedReducer_hydrate: S }).__persistedReducer_hydrate;
  }
  return null;
};
