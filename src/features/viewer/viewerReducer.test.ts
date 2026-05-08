import { INITIAL_VIEWER_STATE, viewerReducer } from './viewerReducer';

import type { CitationRect } from '@shared/types';

const HIGHLIGHT: CitationRect = {
  page: 3,
  x: 10,
  y: 20,
  w: 100,
  h: 12,
  fileName: 'a.pdf',
  marker: 1,
};

describe('viewerReducer', () => {
  it('OPEN sets the document, page, highlight and resets per-doc state', () => {
    const next = viewerReducer(INITIAL_VIEWER_STATE, {
      type: 'OPEN',
      documentId: 'doc-1',
      page: 3,
      highlight: HIGHLIGHT,
    });
    expect(next.open).toEqual({ documentId: 'doc-1', page: 3, highlight: HIGHLIGHT });
    expect(next.pageRenderState).toBe('loading');
    expect(next.totalPages).toBe(0);
    expect(next.driftGuardFired).toBe(false);
  });

  it('OPEN on the same document keeps totalPages/renderState', () => {
    const loaded = viewerReducer(INITIAL_VIEWER_STATE, {
      type: 'OPEN',
      documentId: 'doc-1',
      page: 1,
      highlight: null,
    });
    const withRender = viewerReducer(loaded, {
      type: 'SET_RENDER_STATE',
      renderState: 'rendered',
    });
    const withPages = viewerReducer(withRender, { type: 'SET_TOTAL_PAGES', totalPages: 12 });

    const reopen = viewerReducer(withPages, {
      type: 'OPEN',
      documentId: 'doc-1',
      page: 5,
      highlight: HIGHLIGHT,
    });
    expect(reopen.totalPages).toBe(12);
    expect(reopen.pageRenderState).toBe('rendered');
    expect(reopen.open).toEqual({ documentId: 'doc-1', page: 5, highlight: HIGHLIGHT });
    expect(reopen.driftGuardFired).toBe(false);
  });

  it('OPEN on a different document resets totalPages and renderState', () => {
    const loaded = viewerReducer(INITIAL_VIEWER_STATE, {
      type: 'OPEN',
      documentId: 'doc-1',
      page: 1,
      highlight: null,
    });
    const withRender = viewerReducer(loaded, {
      type: 'SET_RENDER_STATE',
      renderState: 'rendered',
    });
    const withPages = viewerReducer(withRender, { type: 'SET_TOTAL_PAGES', totalPages: 12 });

    const switchDoc = viewerReducer(withPages, {
      type: 'OPEN',
      documentId: 'doc-2',
      page: 1,
      highlight: null,
    });
    expect(switchDoc.totalPages).toBe(0);
    expect(switchDoc.pageRenderState).toBe('loading');
  });

  it('CLOSE returns to the initial state', () => {
    const opened = viewerReducer(INITIAL_VIEWER_STATE, {
      type: 'OPEN',
      documentId: 'doc-1',
      page: 1,
      highlight: null,
    });
    expect(viewerReducer(opened, { type: 'CLOSE' })).toEqual(INITIAL_VIEWER_STATE);
  });

  it('SET_PAGE updates page and clears the highlight', () => {
    const opened = viewerReducer(INITIAL_VIEWER_STATE, {
      type: 'OPEN',
      documentId: 'doc-1',
      page: 3,
      highlight: HIGHLIGHT,
    });
    const next = viewerReducer(opened, { type: 'SET_PAGE', page: 5 });
    expect(next.open?.page).toBe(5);
    expect(next.open?.highlight).toBeNull();
    expect(next.driftGuardFired).toBe(false);
  });

  it('SET_PAGE is ignored when no document is open', () => {
    const next = viewerReducer(INITIAL_VIEWER_STATE, { type: 'SET_PAGE', page: 4 });
    expect(next).toBe(INITIAL_VIEWER_STATE);
  });

  it('SET_RENDER_STATE updates the render state only', () => {
    const next = viewerReducer(INITIAL_VIEWER_STATE, {
      type: 'SET_RENDER_STATE',
      renderState: 'rendering',
    });
    expect(next.pageRenderState).toBe('rendering');
  });

  it('SET_TOTAL_PAGES updates the page count only', () => {
    const next = viewerReducer(INITIAL_VIEWER_STATE, {
      type: 'SET_TOTAL_PAGES',
      totalPages: 27,
    });
    expect(next.totalPages).toBe(27);
  });

  it('SET_DRIFT_GUARD toggles the verdict flag', () => {
    const fired = viewerReducer(INITIAL_VIEWER_STATE, {
      type: 'SET_DRIFT_GUARD',
      fired: true,
    });
    expect(fired.driftGuardFired).toBe(true);
    const cleared = viewerReducer(fired, { type: 'SET_DRIFT_GUARD', fired: false });
    expect(cleared.driftGuardFired).toBe(false);
  });

});
