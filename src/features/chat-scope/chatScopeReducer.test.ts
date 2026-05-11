import { SEND_MESSAGE_SELECTION_MAX } from '@shared/types';

import {
  buildInitialChatScopeState,
  chatScopeReducer,
  type ChatScopeState,
} from './chatScopeReducer';

const seed = (documentIds: string[] = [], folderIds: string[] = []): ChatScopeState => ({
  documentIds,
  folderIds,
});

describe('chatScopeReducer', () => {
  describe('TOGGLE_DOCUMENT', () => {
    it('adds a documentId when absent', () => {
      const next = chatScopeReducer(seed(), {
        type: 'TOGGLE_DOCUMENT',
        documentId: 'doc-1',
      });
      expect(next.documentIds).toEqual(['doc-1']);
      expect(next.folderIds).toEqual([]);
    });

    it('removes a documentId when present', () => {
      const next = chatScopeReducer(seed(['doc-1', 'doc-2']), {
        type: 'TOGGLE_DOCUMENT',
        documentId: 'doc-1',
      });
      expect(next.documentIds).toEqual(['doc-2']);
    });

    it('ignores adds past the per-array cap (returns same state identity)', () => {
      const ids = Array.from({ length: SEND_MESSAGE_SELECTION_MAX }, (_, idx) => `doc-${idx}`);
      const prev = seed(ids);
      const next = chatScopeReducer(prev, {
        type: 'TOGGLE_DOCUMENT',
        documentId: 'doc-overflow',
      });
      expect(next).toBe(prev);
      expect(next.documentIds).toHaveLength(SEND_MESSAGE_SELECTION_MAX);
    });
  });

  describe('TOGGLE_FOLDER', () => {
    it('adds and removes folderId, independent of documentIds', () => {
      const added = chatScopeReducer(seed(['doc-1']), {
        type: 'TOGGLE_FOLDER',
        folderId: 'folder-a',
      });
      expect(added).toEqual({ documentIds: ['doc-1'], folderIds: ['folder-a'] });
      const removed = chatScopeReducer(added, {
        type: 'TOGGLE_FOLDER',
        folderId: 'folder-a',
      });
      expect(removed.folderIds).toEqual([]);
      expect(removed.documentIds).toEqual(['doc-1']);
    });
  });

  describe('REMOVE_DOCUMENT / REMOVE_FOLDER', () => {
    it('removes only the targeted document', () => {
      const next = chatScopeReducer(seed(['doc-1', 'doc-2', 'doc-3']), {
        type: 'REMOVE_DOCUMENT',
        documentId: 'doc-2',
      });
      expect(next.documentIds).toEqual(['doc-1', 'doc-3']);
    });

    it('is a no-op when the document is not in scope', () => {
      const prev = seed(['doc-1']);
      const next = chatScopeReducer(prev, {
        type: 'REMOVE_DOCUMENT',
        documentId: 'doc-missing',
      });
      expect(next).toBe(prev);
    });

    it('removes only the targeted folder', () => {
      const next = chatScopeReducer(seed([], ['f-1', 'f-2']), {
        type: 'REMOVE_FOLDER',
        folderId: 'f-1',
      });
      expect(next.folderIds).toEqual(['f-2']);
    });
  });

  describe('SET_SELECTION', () => {
    it('replaces both arrays', () => {
      const next = chatScopeReducer(seed(['doc-1'], ['f-1']), {
        type: 'SET_SELECTION',
        documentIds: ['doc-2', 'doc-3'],
        folderIds: ['f-2'],
      });
      expect(next).toEqual({ documentIds: ['doc-2', 'doc-3'], folderIds: ['f-2'] });
    });

    it('dedupes incoming arrays', () => {
      const next = chatScopeReducer(seed(), {
        type: 'SET_SELECTION',
        documentIds: ['doc-1', 'doc-1', 'doc-2'],
        folderIds: ['f-1', 'f-1'],
      });
      expect(next.documentIds).toEqual(['doc-1', 'doc-2']);
      expect(next.folderIds).toEqual(['f-1']);
    });

    it('truncates incoming arrays to the per-array cap', () => {
      const ids = Array.from({ length: SEND_MESSAGE_SELECTION_MAX + 10 }, (_, idx) => `doc-${idx}`);
      const next = chatScopeReducer(seed(), {
        type: 'SET_SELECTION',
        documentIds: ids,
        folderIds: [],
      });
      expect(next.documentIds).toHaveLength(SEND_MESSAGE_SELECTION_MAX);
      expect(next.documentIds[SEND_MESSAGE_SELECTION_MAX - 1]).toBe(
        `doc-${SEND_MESSAGE_SELECTION_MAX - 1}`,
      );
    });
  });

  describe('CLEAR and RESET_FOR_COLLECTION_CHANGE', () => {
    it('CLEAR resets both arrays', () => {
      const next = chatScopeReducer(seed(['doc-1'], ['f-1']), { type: 'CLEAR' });
      expect(next).toEqual(buildInitialChatScopeState());
    });

    it('RESET_FOR_COLLECTION_CHANGE resets both arrays', () => {
      const next = chatScopeReducer(seed(['doc-1'], ['f-1']), {
        type: 'RESET_FOR_COLLECTION_CHANGE',
      });
      expect(next).toEqual(buildInitialChatScopeState());
    });

    it('returns the same state identity when already empty', () => {
      const prev = buildInitialChatScopeState();
      expect(chatScopeReducer(prev, { type: 'CLEAR' })).toBe(prev);
      expect(chatScopeReducer(prev, { type: 'RESET_FOR_COLLECTION_CHANGE' })).toBe(prev);
    });
  });
});
