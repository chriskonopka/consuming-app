/**
 * Thin wrapper over the `indexedDB` global. Single object store named
 * `app-state` in a database named `consuming-app`. Per web-persistence.md,
 * never call `indexedDB` directly from components/hooks — go through this
 * module so the lock-down stays in one place.
 *
 * All methods swallow errors and return null/void — IndexedDB can be
 * unavailable (private browsing, quota exhausted, blocked by extensions).
 * Callers fall back to in-memory state and see no exception.
 */

const DB_NAME = 'consuming-app';
const STORE_NAME = 'app-state';
const DB_VERSION = 1;

const openDb = (): Promise<IDBDatabase | null> =>
  new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });

const runTx = <T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> =>
  new Promise((resolve) => {
    openDb().then((db) => {
      if (!db) {
        resolve(null);
        return;
      }
      try {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const request = operation(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
        tx.oncomplete = () => db.close();
        tx.onerror = () => {
          db.close();
          resolve(null);
        };
      } catch {
        db.close();
        resolve(null);
      }
    });
  });

export const idb = {
  get: async <T>(key: string): Promise<T | null> => {
    const result = await runTx<T>('readonly', (store) => store.get(key) as IDBRequest<T>);
    return result ?? null;
  },
  set: async <T>(key: string, value: T): Promise<void> => {
    await runTx('readwrite', (store) => store.put(value, key));
  },
  delete: async (key: string): Promise<void> => {
    await runTx('readwrite', (store) => store.delete(key));
  },
};

export const IDB_DB_NAME = DB_NAME;
export const IDB_STORE_NAME = STORE_NAME;
