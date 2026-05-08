/**
 * Global jest stub for `pdfjs-dist`. The real package ships ESM-only and
 * loads worker resources that jsdom can't satisfy; component tests that touch
 * the viewer module-graph but do not exercise rendering use this stub.
 *
 * Tests that need to assert on pdf.js calls override this with a per-file
 * `jest.mock('pdfjs-dist', ...)` factory (see `DocumentViewer.test.tsx`).
 */

export const GlobalWorkerOptions = { workerSrc: '' };

export const getDocument = jest.fn(() => ({
  promise: Promise.reject(new Error('pdfjs-dist mock — getDocument not stubbed for this test')),
}));

export class TextLayer {
  async render(): Promise<void> {
    return undefined;
  }
}

export type PDFDocumentProxy = unknown;
export type PDFPageProxy = unknown;
export type PageViewport = {
  width: number;
  height: number;
  scale: number;
  rotation: number;
};
export type RenderTask = { promise: Promise<void>; cancel: () => void };
