/**
 * Loads a PDF document for the open viewer.
 *
 * Strategy (REQUIREMENTS.md §5.4 / api-contracts.md §2.4):
 *   - Fetch the PDF body via `useApiClient.raw()` so authentication, the 401
 *     retry, and `X-Operation-Id` telemetry all stay on the single auth path
 *     (`module-boundaries.md` §3.1 — "Token uniformity").
 *   - Pass the resulting `ArrayBuffer` to pdf.js's `getDocument({ data })` so
 *     pdf.js does not perform its own fetch (and never carries headers we'd
 *     have to keep in sync). Range-request optimisation for large PDFs is a
 *     follow-up; v1 fetches the whole file once.
 *   - Destroy the `PDFDocumentLoadingTask` on unmount or documentId change so
 *     pdf.js worker resources are released.
 */

import { useEffect, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

import { useApiClient } from '../../hooks/useApiClient';
import { appInsights } from '../../appInsights';

import { ensurePdfjsConfigured } from './pdfjsConfig';

interface UsePdfDocumentResult {
  pdf: PDFDocumentProxy | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
}

/** Imports pdf.js lazily so its weight only loads when the viewer is used. */
const loadPdfjs = () => import('pdfjs-dist');

export const usePdfDocument = (documentId: string | null): UsePdfDocumentResult => {
  // Destructure the stable `raw` callback rather than depending on the
  // ApiClient object — `useApiClient()` returns a fresh object identity each
  // render but `raw` is memoised inside via useCallback, so destructuring
  // gives us a dep-array-friendly reference that doesn't re-fire the effect.
  const { raw } = useApiClient();
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [status, setStatus] = useState<UsePdfDocumentResult['status']>('idle');

  useEffect(() => {
    if (!documentId) {
      setPdf(null);
      setStatus('idle');
      return undefined;
    }

    let cancelled = false;
    let loadedPdf: PDFDocumentProxy | null = null;
    const abortController = new AbortController();
    setStatus('loading');
    setPdf(null);

    (async () => {
      try {
        ensurePdfjsConfigured();
        // encodeURIComponent guards the path segment against `/` or `..`
        // sneaking in via citation.fileName (defense-in-depth — the API also
        // validates ownership, but a path-traversal attempt should fail
        // client-side too).
        const response = await raw(
          `/documents/${encodeURIComponent(documentId)}/content`,
          { signal: abortController.signal },
        );
        if (cancelled) return;
        if (!response.ok) {
          throw new Error(`pdf-content-fetch-failed-${response.status}`);
        }
        const buffer = await response.arrayBuffer();
        if (cancelled) return;
        const { getDocument } = await loadPdfjs();
        if (cancelled) return;
        const loadingTask = getDocument({ data: new Uint8Array(buffer) });
        const document = await loadingTask.promise;
        if (cancelled) {
          await document.destroy();
          return;
        }
        loadedPdf = document;
        setPdf(document);
        setStatus('ready');
      } catch (error) {
        if (cancelled || abortController.signal.aborted) return;
        // Don't propagate the documentId / fileName into telemetry — file
        // names may contain user-identifying metadata (web-error-logging.md
        // PII discipline). Stage tag is enough to localise the failure.
        appInsights?.trackException({
          exception: error instanceof Error ? error : new Error('pdf-load-error'),
          properties: { stage: 'pdf-load' },
        });
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      abortController.abort();
      // Destroy is fire-and-forget at unmount; errors are observational.
      if (loadedPdf) void loadedPdf.destroy();
    };
  }, [raw, documentId]);

  return { pdf, status };
};
