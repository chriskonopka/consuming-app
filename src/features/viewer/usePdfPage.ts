/**
 * Renders a single PDF page to a `<canvas>` element + builds the matching
 * text layer (selectable, accessible to assistive tech). Returns the page
 * viewport so the highlight overlay can size itself in the same coordinate
 * space.
 *
 * The render is cancelled on page change or unmount so concurrent navigations
 * never leak a stale render task into a now-unmounted canvas.
 */

import { useEffect, useState, type RefObject } from 'react';
import type { PDFDocumentProxy, PageViewport, RenderTask } from 'pdfjs-dist';

import { appInsights } from '../../appInsights';

import type { ViewerAction } from './viewerReducer';
import type { Dispatch } from 'react';

interface UsePdfPageOptions {
  pdf: PDFDocumentProxy | null;
  page: number;
  /** Fallback render scale used when `fitToWidthPx` is null/undefined. */
  scale?: number;
  /**
   * If positive, the render scale is derived so the page's rendered width
   * matches this many CSS pixels (fit-to-width). Takes precedence over `scale`.
   */
  fitToWidthPx?: number | null;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  textLayerRef: RefObject<HTMLDivElement | null>;
  /** Reducer dispatch — used to publish render-state transitions for the UI. */
  dispatch: Dispatch<ViewerAction>;
}

interface UsePdfPageResult {
  viewport: PageViewport | null;
}

const DEFAULT_SCALE = 1.5;

const loadPdfjs = () => import('pdfjs-dist');

export const usePdfPage = ({
  pdf,
  page,
  scale = DEFAULT_SCALE,
  fitToWidthPx,
  canvasRef,
  textLayerRef,
  dispatch,
}: UsePdfPageOptions): UsePdfPageResult => {
  const [viewport, setViewport] = useState<PageViewport | null>(null);

  useEffect(() => {
    if (!pdf) {
      setViewport(null);
      dispatch({ type: 'SET_RENDER_STATE', renderState: 'loading' });
      return undefined;
    }
    if (page < 1 || page > pdf.numPages) {
      // Defensive: clamp upstream rather than rendering an out-of-range page.
      return undefined;
    }

    let cancelled = false;
    let renderTask: RenderTask | null = null;
    dispatch({ type: 'SET_RENDER_STATE', renderState: 'rendering' });

    (async () => {
      try {
        const pdfPage = await pdf.getPage(page);
        if (cancelled) return;
        const naturalViewport = pdfPage.getViewport({ scale: 1 });
        const effectiveScale =
          fitToWidthPx && fitToWidthPx > 0 && naturalViewport.width > 0
            ? fitToWidthPx / naturalViewport.width
            : scale;
        const pageViewport = pdfPage.getViewport({ scale: effectiveScale });

        const canvas = canvasRef.current;
        const textLayerNode = textLayerRef.current;
        if (!canvas) return;

        canvas.width = pageViewport.width;
        canvas.height = pageViewport.height;
        const context = canvas.getContext('2d');
        if (!context) {
          dispatch({ type: 'SET_RENDER_STATE', renderState: 'error' });
          return;
        }

        renderTask = pdfPage.render({ canvasContext: context, viewport: pageViewport });
        await renderTask.promise;
        if (cancelled) return;

        if (textLayerNode) {
          textLayerNode.replaceChildren();
          const textContent = await pdfPage.getTextContent();
          if (cancelled) return;
          const { TextLayer } = await loadPdfjs();
          const layer = new TextLayer({
            textContentSource: textContent,
            container: textLayerNode,
            viewport: pageViewport,
          });
          await layer.render();
          if (cancelled) return;
        }

        setViewport(pageViewport);
        dispatch({ type: 'SET_RENDER_STATE', renderState: 'rendered' });
      } catch (error) {
        if (cancelled) return;
        // pdf.js throws named exceptions on cancel — treat both as a clean exit.
        const errorName = error instanceof Error ? error.name : '';
        if (errorName === 'RenderingCancelledException' || errorName === 'AbortException') {
          return;
        }
        appInsights?.trackException({
          exception: error instanceof Error ? error : new Error('pdf-render-error'),
        });
        dispatch({ type: 'SET_RENDER_STATE', renderState: 'error' });
      }
    })();

    return () => {
      cancelled = true;
      try {
        renderTask?.cancel();
      } catch {
        // pdf.js throws if the task has already completed — observational.
      }
    };
  }, [pdf, page, scale, fitToWidthPx, canvasRef, textLayerRef, dispatch]);

  return { viewport };
};
