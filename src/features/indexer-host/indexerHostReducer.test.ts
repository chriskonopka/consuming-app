import {
  buildInitialIndexerHostState,
  indexerHostReducer,
} from './indexerHostReducer';

describe('indexerHostReducer', () => {
  it('builds initial state from a deep-link snapshot and seeds activeCollection from the URL', () => {
    // Deep-link to /c/<id> means a collection IS active — the indexer is born
    // inside it via the same initialState prop and does not re-emit
    // collection/activated. The reducer seeds activeCollection from the URL
    // so the chat panel does not stay disabled on a fresh page load.
    const state = buildInitialIndexerHostState({
      documentSetId: 'abc',
      folderId: 'folder-1',
      documentId: 'doc-1',
    });
    expect(state).toEqual({
      activeCollection: { documentSetId: 'abc', accessRole: 'Owner' },
      initialState: { documentSetId: 'abc', folderId: 'folder-1', documentId: 'doc-1' },
      remountKey: 0,
    });
  });

  it('builds initial state from an empty snapshot with no activeCollection', () => {
    // No documentSetId in the URL → no collection active → chat panel still
    // shows its empty state until the user opens one.
    expect(buildInitialIndexerHostState({})).toEqual({
      activeCollection: null,
      initialState: {},
      remountKey: 0,
    });
  });

  it('COLLECTION_ACTIVATED with a collection sets activeCollection', () => {
    const initial = buildInitialIndexerHostState({});
    const next = indexerHostReducer(initial, {
      type: 'COLLECTION_ACTIVATED',
      activeCollection: { documentSetId: 'set-1', accessRole: 'Owner' },
    });
    expect(next.activeCollection).toEqual({
      documentSetId: 'set-1',
      accessRole: 'Owner',
    });
    // Other fields unchanged.
    expect(next.initialState).toBe(initial.initialState);
    expect(next.remountKey).toBe(0);
  });

  it('COLLECTION_ACTIVATED with null clears activeCollection', () => {
    const seeded = indexerHostReducer(buildInitialIndexerHostState({}), {
      type: 'COLLECTION_ACTIVATED',
      activeCollection: { documentSetId: 'set-1', accessRole: 'Shared' },
    });
    const next = indexerHostReducer(seeded, {
      type: 'COLLECTION_ACTIVATED',
      activeCollection: null,
    });
    expect(next.activeCollection).toBeNull();
  });

  it('INCREMENT_REMOUNT_KEY bumps the counter monotonically', () => {
    let state = buildInitialIndexerHostState({});
    state = indexerHostReducer(state, { type: 'INCREMENT_REMOUNT_KEY' });
    state = indexerHostReducer(state, { type: 'INCREMENT_REMOUNT_KEY' });
    state = indexerHostReducer(state, { type: 'INCREMENT_REMOUNT_KEY' });
    expect(state.remountKey).toBe(3);
    expect(state.activeCollection).toBeNull();
  });

  it('preserves activeCollection across remount-key increments', () => {
    const seeded = indexerHostReducer(buildInitialIndexerHostState({}), {
      type: 'COLLECTION_ACTIVATED',
      activeCollection: { documentSetId: 'persist', accessRole: 'Owner' },
    });
    const next = indexerHostReducer(seeded, { type: 'INCREMENT_REMOUNT_KEY' });
    expect(next.activeCollection).toEqual({
      documentSetId: 'persist',
      accessRole: 'Owner',
    });
    expect(next.remountKey).toBe(1);
  });
});
