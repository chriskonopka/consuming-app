/**
 * Download-a-document hook.
 *
 * Fetches `/documents/{id}/content` via `useApiClient.raw()` so the bearer
 * token + 401 retry + telemetry stay on the single auth path. The response
 * body is materialised into a Blob, a temporary blob URL is created, and a
 * detached anchor element is clicked to trigger the browser's save dialog
 * with the provided filename. The blob URL is revoked immediately after.
 *
 * `fileName` is the display filename (typically `metadata.fileName` —
 * never `documentId`, which is a GUID). If the caller passes a falsy
 * value, the hook falls back to "document.bin" rather than embedding the
 * GUID, since the GUID is not user-meaningful.
 *
 * Errors are non-fatal: they're surfaced through the returned `status`
 * for UI feedback and logged via App Insights (no fileName in telemetry,
 * per `web-error-logging.md` PII discipline).
 */

import { useCallback, useState } from 'react';

import { appInsights } from '../../appInsights';
import { useApiClient } from '../../hooks/useApiClient';

export type DownloadStatus = 'idle' | 'downloading' | 'error';

export interface UseDownloadDocumentReturn {
  download: (documentId: string, fileName: string | null) => Promise<void>;
  status: DownloadStatus;
}

const DEFAULT_FILENAME = 'document.bin';

export const useDownloadDocument = (): UseDownloadDocumentReturn => {
  const { raw } = useApiClient();
  const [status, setStatus] = useState<DownloadStatus>('idle');

  const download = useCallback(
    async (documentId: string, fileName: string | null) => {
      setStatus('downloading');
      try {
        // encodeURIComponent guards the path segment against `/` / `..` in
        // documentId — defense in depth, same as `usePdfDocument`.
        const response = await raw(
          `/documents/${encodeURIComponent(documentId)}/content`,
        );
        if (!response.ok) {
          appInsights?.trackException({
            exception: new Error(`download-failed-${response.status}`),
            properties: { stage: 'download', status: String(response.status) },
          });
          setStatus('error');
          return;
        }
        const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
        const buffer = await response.arrayBuffer();
        const blob = new Blob([buffer], { type: contentType });
        const url = URL.createObjectURL(blob);
        try {
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = fileName && fileName.length > 0 ? fileName : DEFAULT_FILENAME;
          // Anchor must be attached for Firefox; detached attribute click
          // succeeds in Chrome/Safari but Firefox is stricter.
          anchor.style.display = 'none';
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
        } finally {
          URL.revokeObjectURL(url);
        }
        setStatus('idle');
      } catch (error) {
        appInsights?.trackException({
          exception: error instanceof Error ? error : new Error('download-error'),
          properties: { stage: 'download' },
        });
        setStatus('error');
      }
    },
    [raw],
  );

  return { download, status };
};
