import {
  SEND_MESSAGE_SELECTION_MAX,
  type SelectionDocument,
  type SelectionFolder,
} from '@shared/types';

import {
  buildInitialChatScopeState,
  chatScopeReducer,
  type ChatScopeState,
} from './chatScopeReducer';

const doc = (documentId: string, fileName = `${documentId}.pdf`): SelectionDocument => ({
  documentId,
  fileName,
});

const folder = (
  folderId: string,
  folderName = folderId,
  path = `root/${folderName}`,
): SelectionFolder => ({ folderId, folderName, path });

const seed = (
  documents: SelectionDocument[] = [],
  folders: SelectionFolder[] = [],
): ChatScopeState => ({ documents, folders });

describe('chatScopeReducer', () => {
  describe('SET_SELECTION', () => {
    it('replaces both arrays with the indexer-supplied payload', () => {
      const next = chatScopeReducer(seed([doc('old')], [folder('old-f')]), {
        type: 'SET_SELECTION',
        documents: [doc('a'), doc('b')],
        folders: [folder('f-1')],
      });
      expect(next.documents).toEqual([doc('a'), doc('b')]);
      expect(next.folders).toEqual([folder('f-1')]);
    });

    it('dedupes incoming arrays by id (first occurrence wins)', () => {
      const next = chatScopeReducer(seed(), {
        type: 'SET_SELECTION',
        documents: [doc('a', 'first.pdf'), doc('a', 'duplicate.pdf'), doc('b')],
        folders: [folder('f-1'), folder('f-1')],
      });
      expect(next.documents).toEqual([doc('a', 'first.pdf'), doc('b')]);
      expect(next.folders).toEqual([folder('f-1')]);
    });

    it('truncates incoming arrays to the per-array cap', () => {
      const overflow = Array.from({ length: SEND_MESSAGE_SELECTION_MAX + 10 }, (_, idx) =>
        doc(`doc-${idx}`),
      );
      const next = chatScopeReducer(seed(), {
        type: 'SET_SELECTION',
        documents: overflow,
        folders: [],
      });
      expect(next.documents).toHaveLength(SEND_MESSAGE_SELECTION_MAX);
      expect(next.documents[SEND_MESSAGE_SELECTION_MAX - 1].documentId).toBe(
        `doc-${SEND_MESSAGE_SELECTION_MAX - 1}`,
      );
    });
  });

  describe('REMOVE_DOCUMENT / REMOVE_FOLDER (local override)', () => {
    it('removes only the targeted document by id', () => {
      const next = chatScopeReducer(seed([doc('a'), doc('b'), doc('c')]), {
        type: 'REMOVE_DOCUMENT',
        documentId: 'b',
      });
      expect(next.documents.map((document) => document.documentId)).toEqual(['a', 'c']);
    });

    it('is a no-op when the document is not present (same state identity)', () => {
      const prev = seed([doc('a')]);
      const next = chatScopeReducer(prev, { type: 'REMOVE_DOCUMENT', documentId: 'missing' });
      expect(next).toBe(prev);
    });

    it('removes only the targeted folder by id', () => {
      const next = chatScopeReducer(seed([], [folder('f-1'), folder('f-2')]), {
        type: 'REMOVE_FOLDER',
        folderId: 'f-1',
      });
      expect(next.folders.map((value) => value.folderId)).toEqual(['f-2']);
    });
  });

  describe('CLEAR and RESET_FOR_COLLECTION_CHANGE', () => {
    it('CLEAR resets both arrays', () => {
      const next = chatScopeReducer(seed([doc('a')], [folder('f-1')]), { type: 'CLEAR' });
      expect(next).toEqual(buildInitialChatScopeState());
    });

    it('RESET_FOR_COLLECTION_CHANGE resets both arrays', () => {
      const next = chatScopeReducer(seed([doc('a')], [folder('f-1')]), {
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
