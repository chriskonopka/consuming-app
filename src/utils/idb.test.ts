import { idb, __resetDbForTests } from './idb';

describe('idb wrapper', () => {
  beforeEach(() => {
    __resetDbForTests();
  });

  it('returns null for an unknown key', async () => {
    expect(await idb.get('nope')).toBeNull();
  });

  it('round-trips a value', async () => {
    await idb.set('greeting', 'hello');
    expect(await idb.get('greeting')).toBe('hello');
  });

  it('round-trips a structured value', async () => {
    const value = { count: 3, items: ['a', 'b'] };
    await idb.set('shape', value);
    expect(await idb.get('shape')).toEqual(value);
  });

  it('overwrites an existing key', async () => {
    await idb.set('k', 1);
    await idb.set('k', 2);
    expect(await idb.get('k')).toBe(2);
  });

  it('deletes a key', async () => {
    await idb.set('to-remove', 'x');
    await idb.delete('to-remove');
    expect(await idb.get('to-remove')).toBeNull();
  });
});
