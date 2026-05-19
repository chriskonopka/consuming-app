/**
 * Loads an image document for the viewer (REQUIREMENTS.md §5.5).
 *
 * Mirrors `usePdfDocument`'s contract:
 *   - Fetch via `useApiClient.raw()` so the bearer token, 401-retry, and
 *     `X-Operation-Id` telemetry stay on the canonical auth path
 *     (module-boundaries.md §3.1 — "Token uniformity").
 *   - The body is converted to an object URL via `bytesToBlobUrl` because
 *     `<img src=…>` cannot carry an `Authorization` header.
 *   - The object URL is revoked on documentId change or unmount so the
 *     underlying bytes don't leak in memory (revoking is the caller's
 *     responsibility — `bytesToBlobUrl` is intentionally minimal).
 */

import { useEffect, useState } from 'react';

import { useApiClient } from '../../hooks/useApiClient';
import { appInsights } from '../../appInsights';
import { bytesToBlobUrl } from '../../utils/bytesToBlobUrl';

export interface UseImageDocumentResult {
  url: string | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
}

export const useImageDocument = (documentId: string | null): UseImageDocumentResult => {
  const { raw } = useApiClient();
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<UseImageDocumentResult['status']>('idle');

  useEffect(() => {
    if (!documentId) {
      setUrl(null);
      setStatus('idle');
      return undefined;
    }

    let cancelled = false;
    let createdUrl: string | null = null;
    const abortController = new AbortController();
    setStatus('loading');
    setUrl(null);

    (async () => {
      try {
        // Defense-in-depth: encodeURIComponent stops a `/` or `..` in
        // documentId (citation.fileName in v1) from producing a path-traversal
        // request. The API enforces ownership too, but client-side hardening
        // here matches the slice-4 PDF path.
        const response = await raw(
          `/documents/${encodeURIComponent(documentId)}/content`,
          { signal: abortController.signal },
        );
        if (cancelled) return;
        if (!response.ok) {
          throw new Error(`image-content-fetch-failed-${response.status}`);
        }
        const contentType = response.headers.get('content-type') ?? undefined;
        // Prefer streaming when available — large images (e.g. high-DPI
        // scans) avoid a single ArrayBuffer copy. Fall back to
        // `blob()`/`arrayBuffer()` when the body isn't a ReadableStream
        // (test environment, older browsers).
        let objectUrl: string;
        if (response.body) {
          objectUrl = await bytesToBlobUrl(response.body, contentType);
        } else {
          const buffer = await response.arrayBuffer();
          if (cancelled) return;
          objectUrl = URL.createObjectURL(
            new Blob([new Uint8Array(buffer)], contentType ? { type: contentType } : undefined),
          );
        }
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        createdUrl = objectUrl;
        setUrl(objectUrl);
        setStatus('ready');
      } catch (error) {
        if (cancelled || abortController.signal.aborted) return;
        // Don't include documentId in telemetry properties — file names may
        // carry user-identifying metadata (web-error-logging.md PII discipline).
        appInsights?.trackException({
          exception: error instanceof Error ? error : new Error('image-load-error'),
          properties: { stage: 'image-load' },
        });
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      abortController.abort();
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [raw, documentId]);

  return { url, status };
};
