import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import type { Dispatch } from 'react';
import type { PageViewport } from 'pdfjs-dist';

import type { CitationRect } from '@shared/types';

import { HighlightOverlay } from './HighlightOverlay';
import type { ViewerAction } from './viewerReducer';

const buildViewport = (partial: Partial<PageViewport> = {}): PageViewport =>
  ({
    width: 800,
    height: 1000,
    scale: 1.5,
    rotation: 0,
    ...partial,
  }) as PageViewport;

const HIGHLIGHT: CitationRect = {
  page: 1,
  x: 100,
  y: 200,
  w: 300,
  h: 12, // 12 * 1.5 = 18px → 1.8% of 1000px page height (well under 25%)
  fileName: 'a.pdf',
  marker: 1,
};

describe('HighlightOverlay', () => {
  it('renders nothing when no highlight is supplied', () => {
    const dispatch = jest.fn() as Dispatch<ViewerAction>;
    const { container } = render(
      <HighlightOverlay highlight={null} viewport={buildViewport()} dispatch={dispatch} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing while waiting for the viewport', () => {
    const dispatch = jest.fn() as Dispatch<ViewerAction>;
    const { container } = render(
      <HighlightOverlay highlight={HIGHLIGHT} viewport={null} dispatch={dispatch} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the rect at scaled coordinates when drift guard accepts', () => {
    const dispatch = jest.fn();
    const { getByTestId } = render(
      <HighlightOverlay highlight={HIGHLIGHT} viewport={buildViewport()} dispatch={dispatch} />,
    );
    const overlay = getByTestId('citation-highlight');
    expect(overlay.style.left).toBe('150px'); // 100 * 1.5
    expect(overlay.style.top).toBe('300px'); // 200 * 1.5
    expect(overlay.style.width).toBe('450px'); // 300 * 1.5
    expect(overlay.style.height).toBe('18px'); // 12 * 1.5
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_DRIFT_GUARD', fired: false });
  });

  it('rejects highlights covering > 50% of the page height', () => {
    const dispatch = jest.fn();
    // h * scale = 400 * 1.5 = 600; pageHeight = 1000; ratio = 0.60 → reject
    const tall: CitationRect = { ...HIGHLIGHT, h: 400 };
    const { queryByTestId } = render(
      <HighlightOverlay highlight={tall} viewport={buildViewport()} dispatch={dispatch} />,
    );
    expect(queryByTestId('citation-highlight')).toBeNull();
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_DRIFT_GUARD', fired: true });
  });

  it('renders at exactly 50% of page height (boundary)', () => {
    const dispatch = jest.fn();
    // h * scale must equal exactly 50% of pageHeight: 1000 * 0.5 = 500 px → h = 500/1.5
    const exact: CitationRect = { ...HIGHLIGHT, h: 500 / 1.5 };
    const { queryByTestId } = render(
      <HighlightOverlay highlight={exact} viewport={buildViewport()} dispatch={dispatch} />,
    );
    expect(queryByTestId('citation-highlight')).not.toBeNull();
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_DRIFT_GUARD', fired: false });
  });

  it('rejects just over 50% of page height (boundary)', () => {
    const dispatch = jest.fn();
    // h * scale > 500 px (> 50%)
    const justOver: CitationRect = { ...HIGHLIGHT, h: 500.1 / 1.5 };
    const { queryByTestId } = render(
      <HighlightOverlay highlight={justOver} viewport={buildViewport()} dispatch={dispatch} />,
    );
    expect(queryByTestId('citation-highlight')).toBeNull();
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_DRIFT_GUARD', fired: true });
  });

  it('renders highlights between 25% and 50% (previously rejected, now allowed)', () => {
    const dispatch = jest.fn();
    // h * scale = 250 * 1.5 = 375; pageHeight = 1000; ratio = 0.375 → render
    const moderate: CitationRect = { ...HIGHLIGHT, h: 250 };
    const { queryByTestId } = render(
      <HighlightOverlay highlight={moderate} viewport={buildViewport()} dispatch={dispatch} />,
    );
    expect(queryByTestId('citation-highlight')).not.toBeNull();
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_DRIFT_GUARD', fired: false });
  });

  it('scales correctly at a different render scale', () => {
    const dispatch = jest.fn();
    const viewport = buildViewport({ scale: 2.0, height: 2000 });
    const { getByTestId } = render(
      <HighlightOverlay highlight={HIGHLIGHT} viewport={viewport} dispatch={dispatch} />,
    );
    const overlay = getByTestId('citation-highlight');
    expect(overlay.style.left).toBe('200px'); // 100 * 2.0
    expect(overlay.style.top).toBe('400px'); // 200 * 2.0
  });

  it('has no axe violations', async () => {
    const dispatch = jest.fn() as Dispatch<ViewerAction>;
    const { container } = render(
      <HighlightOverlay highlight={HIGHLIGHT} viewport={buildViewport()} dispatch={dispatch} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
