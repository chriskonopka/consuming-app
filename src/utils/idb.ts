/**
 * What belongs here: thin wrapper over the `indexedDB` global. Single object
 * store named `app-state` in a database named `consuming-app`. Per
 * web-persistence.md, never call `indexedDB` directly from components/hooks
 * — go through this module so the lock-down stays in one place.
 *
 * Scaffolded — implementation lands in slice 1 (used by usePersistedReducer).
 */

const DB_NAME = 'consuming-app';
const STORE_NAME = 'app-state';

export const idb = {
  get: async <T>(_key: string): Promise<T | null> => {
    // slice 1
    return null;
  },
  set: async <T>(_key: string, _value: T): Promise<void> => {
    // slice 1
  },
  delete: async (_key: string): Promise<void> => {
    // slice 1
  },
};

// Re-export constants so usePersistedReducer can reference them without a magic string.
export const IDB_DB_NAME = DB_NAME;
export const IDB_STORE_NAME = STORE_NAME;
