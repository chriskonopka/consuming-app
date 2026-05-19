/**
 * Renders an image document (REQUIREMENTS.md §5.5) plus the citation overlay.
 *
 * Image bytes are fetched via the auth-aware API client and converted to a
 * blob URL (`useImageDocument`). The displayed image is sized to its natural
 * dimensions; once `<img>` loads, we publish a synthetic `OverlayViewport`
 * (scale: 1, image's natural width/height) so the existing
 * `<HighlightOverlay>` machinery — including the drift guard — is identical
 * across the PDF and image paths.
 */

import { useCallback, useEffect, useState } from 'react';
import type { Dispatch } from 'react';

import type { CitationRect } from '@shared/types';

import { LoadingSpinner } from '../../components/LoadingSpinner';

import { HighlightOverlay, type OverlayViewport } from './HighlightOverlay';
import { useImageDocument } from './useImageDocument';
import type { ViewerAction } from './viewerReducer';

import styles from './DocumentViewer.module.scss';

interface Props {
  documentId: string;
  /** Optional display name from server metadata — used as the image alt text. */
  fileName?: string;
  highlight: CitationRect | null;
  dispatch: Dispatch<ViewerAction>;
}

export const ImageRenderer = ({ documentId, fileName, highlight, dispatch }: Props) => {
  const { url, status } = useImageDocument(documentId);
  const [viewport, setViewport] = useState<OverlayViewport | null>(null);

  // Reset render-state for the orchestrator's banner logic. Images don't go
  // through pdf.js's loading→rendering→rendered lifecycle, so we publish the
  // equivalent transitions ourselves.
  useEffect(() => {
    if (status === 'loading') dispatch({ type: 'SET_RENDER_STATE', renderState: 'loading' });
    else if (status === 'error') dispatch({ type: 'SET_RENDER_STATE', renderState: 'error' });
  }, [status, dispatch]);

  // Reset viewport when the document changes — the previous image's natural
  // dimensions must not leak into a freshly-loaded one.
  useEffect(() => {
    setViewport(null);
  }, [documentId]);

  const handleImageLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      const img = event.currentTarget;
      // Image citation coords are pixels (REQUIREMENTS.md §5.5), so the scale
      // multiplier is identity. Width/height come from the loaded bitmap.
      setViewport({ scale: 1, width: img.naturalWidth, height: img.naturalHeight });
      dispatch({ type: 'SET_RENDER_STATE', renderState: 'rendered' });
      // Images are single-page; treat as page 1 of 1 so the page-count UI
      // stays consistent with PDFs.
      dispatch({ type: 'SET_TOTAL_PAGES', totalPages: 1 });
    },
    [dispatch],
  );

  const handleImageError = useCallback(() => {
    dispatch({ type: 'SET_RENDER_STATE', renderState: 'error' });
  }, [dispatch]);

  if (status === 'loading' || !url) {
    return (
      <div className={styles.loading}>
        <LoadingSpinner ariaLabel={`Loading ${documentId}`} />
      </div>
    );
  }

  return (
    <div className={styles.pageStage}>
      <div className={styles.pageWrap}>
        <img
          src={url}
          alt={fileName ?? documentId}
          className={styles.canvas}
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
        <div className={styles.highlightLayer}>
          <HighlightOverlay highlight={highlight} viewport={viewport} dispatch={dispatch} />
        </div>
      </div>
    </div>
  );
};
