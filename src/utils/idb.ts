/**
 * Thin wrapper over the `indexedDB` global. Single object store named
 * `app-state` in a database named `consuming-app`. Per web-persistence.md,
 * never call `indexedDB` directly from components/hooks — go through this
 * module so the lock-down stays in one place.
 */

const DB_NAME = 'consuming-app';
const STORE_NAME = 'app-state';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

const openDb = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
};

const tx = async <T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T> | undefined,
): Promise<T | null> => {
  try {
    const db = await openDb();
    return await new Promise<T | null>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      const request = work(store);
      transaction.oncomplete = () => {
        if (!request) {
          resolve(null);
          return;
        }
        resolve((request.result as T) ?? null);
      };
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } catch {
    // IDB unavailable (private mode, quota, etc.) — caller falls back to in-memory.
    return null;
  }
};

export const idb = {
  get: <T>(key: string): Promise<T | null> =>
    tx<T>('readonly', (store) => store.get(key) as IDBRequest<T>),
  set: async <T>(key: string, value: T): Promise<void> => {
    await tx('readwrite', (store) => store.put(value, key));
  },
  delete: async (key: string): Promise<void> => {
    await tx('readwrite', (store) => store.delete(key));
  },
};

export const IDB_DB_NAME = DB_NAME;
export const IDB_STORE_NAME = STORE_NAME;

// Test-only — reset the cached db handle so tests get a fresh connection.
export const __resetDbForTests = (): void => {
  dbPromise = null;
};
