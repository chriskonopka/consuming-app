/**
 * pdf.js worker bootstrap. The worker is bundled by webpack 5 via the
 * `asset/resource` rule for `pdfjs-dist/build/pdf.worker.min.mjs` (see
 * `webpack.config.js`); the URL is supplied to `GlobalWorkerOptions` once on
 * first use.
 *
 * Tests mock the worker import via jest's `moduleNameMapper` so this module
 * is safe to import in jsdom — the worker URL resolves to a stub string and
 * no real worker is spawned.
 */

import { GlobalWorkerOptions } from 'pdfjs-dist';

import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs';

let configured = false;

export const ensurePdfjsConfigured = (): void => {
  if (configured) return;
  configured = true;
  // workerUrl is a string emitted by webpack's asset/resource pipeline at
  // build time; in tests jest's moduleNameMapper points the import at a stub.
  GlobalWorkerOptions.workerSrc = workerUrl;
};
