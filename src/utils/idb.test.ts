import { idb, IDB_DB_NAME, IDB_STORE_NAME } from './idb';

describe('idb', () => {
  it('returns null for unset keys', async () => {
    const result = await idb.get<string>('nonexistent');
    expect(result).toBeNull();
  });

  it('round-trips values via set/get', async () => {
    await idb.set('round-trip', { count: 42, label: 'hello' });
    const result = await idb.get<{ count: number; label: string }>('round-trip');
    expect(result).toEqual({ count: 42, label: 'hello' });
  });

  it('overwrites prior values on set', async () => {
    await idb.set('overwrite', 'first');
    await idb.set('overwrite', 'second');
    expect(await idb.get<string>('overwrite')).toBe('second');
  });

  it('deletes keys', async () => {
    await idb.set('to-delete', 'value');
    await idb.delete('to-delete');
    expect(await idb.get<string>('to-delete')).toBeNull();
  });

  it('exports the canonical db + store names', () => {
    expect(IDB_DB_NAME).toBe('consuming-app');
    expect(IDB_STORE_NAME).toBe('app-state');
  });

  it('returns null when indexedDB is unavailable', async () => {
    const original = global.indexedDB;
    // Remove the global so openDb's `typeof indexedDB === 'undefined'` branch fires.
    // @ts-expect-error -- intentional unset for the no-storage branch
    delete global.indexedDB;
    try {
      const result = await idb.get<string>('any-key');
      expect(result).toBeNull();
      // set/delete also no-op without throwing
      await expect(idb.set('any', 'value')).resolves.toBeUndefined();
      await expect(idb.delete('any')).resolves.toBeUndefined();
    } finally {
      global.indexedDB = original;
    }
  });
});
