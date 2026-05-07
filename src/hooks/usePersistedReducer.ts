/**
 * What belongs here: IndexedDB-backed reducer hook (per web-persistence.md).
 * Loads from IDB on mount, merges with initialState, persists every state
 * change debounced 250ms. Errors swallowed with .catch() — falls back to
 * in-memory state if IDB is unavailable.
 *
 * Scaffolded — implementation lands in slice 1 (used by app-shell for
 * panel state).
 */

import { useReducer, type Dispatch, type Reducer } from 'react';

export const usePersistedReducer = <S, A>(
  _key: string,
  reducer: Reducer<S, A>,
  initialState: S,
): [S, Dispatch<A>] => {
  // Slice 1 wraps useReducer with IDB hydrate + persist. For the scaffold,
  // we return a plain useReducer so consumers can compile and run.
  return useReducer(reducer, initialState);
};
