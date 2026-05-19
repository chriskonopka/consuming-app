/**
 * Renders the citation highlight rectangle over the rendered page.
 *
 * Geometry contract (REQUIREMENTS.md §5.6 / api-contracts.md):
 *   - Citation coords are PDF points, origin top-left, scaled to the current
 *     `pageViewport.scale` to get pixel coordinates inside the canvas.
 *   - Drift guard rejects rectangles taller than `DRIFT_GUARD_MAX_PAGE_FRACTION`
 *     of the page height; the caller renders a "Couldn't locate" banner in
 *     place of the rectangle.
 *
 * Highlight color comes from `--color-warning` mixed via `color-mix(...)`
 * (per `web-styling.md` — never hardcoded `rgba`).
 */

import { useEffect } from 'react';

import type { CitationRect } from '@shared/types';
import { driftGuard } from '@shared/types';

import type { ViewerAction } from './viewerReducer';
import type { Dispatch } from 'react';

import styles from './HighlightOverlay.module.scss';

/**
 * Geometry input to the overlay — a viewport-shaped subset of pdf.js's
 * `PageViewport`. Image rendering (slice 5) supplies a synthetic instance with
 * `scale: 1` and the displayed image dimensions because image citation
 * coordinates are already in pixels (REQUIREMENTS.md §5.5).
 */
export interface OverlayViewport {
  scale: number;
  width: number;
  height: number;
}

interface Props {
  highlight: CitationRect | null;
  viewport: OverlayViewport | null;
  /** Reducer dispatch — used so the orchestrator can react to drift-guard verdicts. */
  dispatch: Dispatch<ViewerAction>;
}

export const HighlightOverlay = ({ highlight, viewport, dispatch }: Props) => {
  // The verdict is a function of (highlight, viewport) — derive it on every render
  // and publish it back to the reducer so the parent can render the right banner.
  const verdict = highlight && viewport
    ? driftGuard(highlight.h * viewport.scale, viewport.height)
    : null;

  useEffect(() => {
    if (verdict === null) return;
    dispatch({ type: 'SET_DRIFT_GUARD', fired: verdict === 'reject' });
  }, [verdict, dispatch]);

  if (!highlight || !viewport || verdict !== 'render') return null;

  const left = highlight.x * viewport.scale;
  const top = highlight.y * viewport.scale;
  const width = highlight.w * viewport.scale;
  const height = highlight.h * viewport.scale;

  return (
    <div
      className={styles.overlay}
      data-testid="citation-highlight"
      aria-hidden="true"
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
      }}
    />
  );
};
