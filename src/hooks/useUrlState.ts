/**
 * What belongs here: reads/writes the `/c/{id}?folderId=&documentId=` URL
 * shape via react-router-dom (added in slice 1). Push-state by default so
 * back-button works.
 *
 * Scaffolded — implementation lands in slice 2 (used by indexer-host).
 */

interface UrlState {
  documentSetId: string | null;
  folderId: string | null;
  documentId: string | null;
  pushCollection: (id: string | null) => void;
  pushDocument: (id: string | null) => void;
}

export const useUrlState = (): UrlState => {
  return {
    documentSetId: null,
    folderId: null,
    documentId: null,
    pushCollection: () => {
      // slice 2
    },
    pushDocument: () => {
      // slice 2
    },
  };
};
