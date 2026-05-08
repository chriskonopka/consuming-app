/**
 * IndexedDB-backed reducer (per web-persistence.md). Loads from IDB on mount,
 * merges with `initialState`, persists every state change debounced 250ms.
 * Errors are swallowed — falls back to in-memory state if IDB is unavailable.
 *
 * Note: the first render returns `initialState`. Hydration happens
 * asynchronously after mount; once the persisted value loads, the reducer
 * dispatches a private rehydrate action. Consumers do not see partial state.
 */

import { useEffect, useReducer, useRef, type Dispatch, type Reducer } from 'react';

import { idb } from '../utils/idb';

const PERSIST_DEBOUNCE_MS = 250;

const REHYDRATE_ACTION = '__persistedReducer/rehydrate' as const;

type InternalAction<S, A> = A | { type: typeof REHYDRATE_ACTION; payload: S };

const wrapReducer =
  <S, A>(reducer: Reducer<S, A>): Reducer<S, InternalAction<S, A>> =>
  (state, action) => {
    if (
      typeof action === 'object' &&
      action !== null &&
      'type' in action &&
      (action as { type: unknown }).type === REHYDRATE_ACTION
    ) {
      return (action as { type: typeof REHYDRATE_ACTION; payload: S }).payload;
    }
    return reducer(state, action as A);
  };

export const usePersistedReducer = <S, A>(
  key: string,
  reducer: Reducer<S, A>,
  initialState: S,
): [S, Dispatch<A>] => {
  const wrapped = useRef(wrapReducer(reducer)).current;
  const [state, dispatch] = useReducer(wrapped, initialState);

  const hasHydrated = useRef(false);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    idb
      .get<S>(key)
      .then((stored) => {
        if (cancelled || stored === null) {
          hasHydrated.current = true;
          return;
        }
        dispatch({
          type: REHYDRATE_ACTION,
          payload: { ...initialState, ...stored },
        } as InternalAction<S, A>);
        hasHydrated.current = true;
      })
      .catch(() => {
        hasHydrated.current = true;
      });
    return () => {
      cancelled = true;
    };
    // initialState is captured once at mount on purpose — re-running hydrate on
    // every initialState identity change would clobber user edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!hasHydrated.current) return;
    if (persistTimer.current !== null) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      idb.set(key, state).catch(() => {
        // Storage failure is non-fatal — state remains in memory.
      });
    }, PERSIST_DEBOUNCE_MS);
    return () => {
      if (persistTimer.current !== null) clearTimeout(persistTimer.current);
    };
  }, [key, state]);

  return [state, dispatch as Dispatch<A>];
};
