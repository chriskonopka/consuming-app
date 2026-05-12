/**
 * Right-side panel that renders PDFs (slice 4) and images (slice 5).
 *
 * Reads `useViewer()` for the open document + page + highlight, then:
 *   - Loads metadata via TanStack Query (header strip).
 *   - Loads the PDF body via `useApiClient.raw()` and feeds it to pdf.js.
 *   - Renders the canvas + text layer + highlight overlay (three-layer per
 *     REQUIREMENTS.md §5.4).
 *   - Honours the drift-guard verdict — `<HighlightOverlay>` reports back
 *     via the shared reducer; we surface the "Couldn't locate" banner here.
 *   - Wires PageUp/PageDown to the panel's keydown.
 */

import { useCallback, useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';

import { LoadingSpinner } from '../../components/LoadingSpinner';
import { Panel } from '../../components/Panel';
import { Splitter } from '../../components/Splitter';

import { HighlightOverlay } from './HighlightOverlay';
import { PageNavigation } from './PageNavigation';
import { ViewerHeader } from './ViewerHeader';
import { useDocumentMetadata } from './useDocumentMetadata';
import { usePdfDocument } from './usePdfDocument';
import { usePdfPage } from './usePdfPage';
import { useViewer } from './ViewerContext';

import styles from './DocumentViewer.module.scss';

export const VIEWER_PANEL_MIN_PX = 360;
export const VIEWER_PANEL_MAX_PX = 960;

const PANEL_ID = 'document-viewer-panel';

// Matches the horizontal padding declared on `.body` (0.75rem * 2) plus a
// safety buffer for the panel border + a potential vertical scrollbar gutter.
// Together they keep the rendered page narrower than the viewport so the
// horizontal scrollbar never appears for standard page sizes.
const VIEWER_BODY_HORIZONTAL_PADDING_PX = 24;
const VIEWER_FIT_SAFETY_BUFFER_PX = 20;
const VIEWER_MIN_FIT_WIDTH_PX = 120;

interface Props {
  open: boolean;
  widthPx: number;
  onResize?: (widthPx: number) => void;
}

export const DocumentViewer = ({ open, widthPx, onResize }: Props) => {
  const viewer = useViewer();
  const { state, close, setPage, dispatch } = viewer;
  const { open: openDoc, pageRenderState, totalPages, driftGuardFired } = state;
  const documentId = openDoc?.documentId ?? null;
  const page = openDoc?.page ?? 1;
  const highlight = openDoc?.highlight ?? null;

  const metadata = useDocumentMetadata(documentId);
  const pdf = usePdfDocument(documentId);

  // Update totalPages once the PDF loads — keep the reducer's view of the
  // document in sync with pdf.js's authoritative count.
  useEffect(() => {
    if (pdf.pdf && totalPages !== pdf.pdf.numPages) {
      dispatch({ type: 'SET_TOTAL_PAGES', totalPages: pdf.pdf.numPages });
    }
  }, [pdf.pdf, totalPages, dispatch]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const highlightLayerRef = useRef<HTMLDivElement>(null);

  const fitToWidthPx = Math.max(
    VIEWER_MIN_FIT_WIDTH_PX,
    widthPx - VIEWER_BODY_HORIZONTAL_PADDING_PX - VIEWER_FIT_SAFETY_BUFFER_PX,
  );

  const { viewport } = usePdfPage({
    pdf: pdf.pdf,
    page,
    fitToWidthPx,
    canvasRef,
    textLayerRef,
    dispatch,
  });

  // Auto-scroll the highlight into view (REQUIREMENTS.md §5.6) once the page
  // renders and a highlight is present and the drift guard accepted it.
  useEffect(() => {
    if (
      pageRenderState !== 'rendered' ||
      !highlight ||
      driftGuardFired ||
      !viewport ||
      !highlightLayerRef.current
    ) {
      return;
    }
    const overlay = highlightLayerRef.current.querySelector<HTMLElement>(
      '[data-testid="citation-highlight"]',
    );
    overlay?.scrollIntoView({ block: 'center' });
  }, [pageRenderState, highlight, driftGuardFired, viewport]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'PageDown' && page < totalPages) {
        event.preventDefault();
        setPage(page + 1);
      } else if (event.key === 'PageUp' && page > 1) {
        event.preventDefault();
        setPage(page - 1);
      }
    },
    [page, totalPages, setPage],
  );

  const renderingBanner =
    highlight && pageRenderState !== 'rendered' && !driftGuardFired ? (
      <div className={styles.banner} role="status" aria-live="polite">
        Locating citation on page {highlight.page}…
      </div>
    ) : null;

  const driftBanner = driftGuardFired ? (
    <div className={styles.bannerWarning} role="status" aria-live="polite">
      Couldn&rsquo;t locate this quote on the page.
    </div>
  ) : null;

  const errorBanner =
    pdf.status === 'error' || pageRenderState === 'error' ? (
      <div className={styles.bannerError} role="alert">
        Could not load this document. Try closing and reopening it.
      </div>
    ) : null;

  return (
    <Panel
      id={PANEL_ID}
      side="right"
      open={open}
      widthPx={widthPx}
      onClose={close}
      ariaLabel="Document viewer"
    >
      <ViewerHeader
        metadata={metadata.data}
        documentId={documentId}
        totalPages={totalPages}
        onClose={close}
      />

      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-static-element-interactions -- body is a focus stop for PageUp/Down keyboard navigation; the role=dialog ancestor is the announced container */}
      <div className={styles.body} tabIndex={0} onKeyDown={handleKeyDown}>
        {renderingBanner}
        {driftBanner}
        {errorBanner}

        {documentId === null ? (
          <div className={styles.empty} role="status" aria-live="polite">
            <p>No document open.</p>
          </div>
        ) : pdf.status === 'loading' ? (
          <div className={styles.loading}>
            <LoadingSpinner ariaLabel={`Loading ${documentId}`} />
          </div>
        ) : (
          <div className={styles.pageStage}>
            <div className={styles.pageWrap}>
              <canvas ref={canvasRef} className={styles.canvas} />
              <div ref={textLayerRef} className={styles.textLayer} aria-hidden="true" />
              <div ref={highlightLayerRef} className={styles.highlightLayer}>
                <HighlightOverlay
                  highlight={highlight}
                  viewport={viewport}
                  dispatch={dispatch}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className={styles.footer}>
        <PageNavigation
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          disabled={pdf.status !== 'ready'}
        />
      </footer>

      {onResize && (
        <div className={styles.resizeEdge}>
          <Splitter
            direction="horizontal"
            resizeFrom="right"
            widthPx={widthPx}
            minPx={VIEWER_PANEL_MIN_PX}
            maxPx={VIEWER_PANEL_MAX_PX}
            onResize={onResize}
            ariaLabel="Resize document viewer"
          />
        </div>
      )}
    </Panel>
  );
};
