import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

import type { CitationRect } from '@shared/types';

import { ViewerProvider, useViewer } from './ViewerContext';

const HIGHLIGHT: CitationRect = {
  page: 3,
  x: 10,
  y: 20,
  w: 100,
  h: 12,
  fileName: 'a.pdf',
  marker: 1,
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <ViewerProvider>{children}</ViewerProvider>
);

describe('ViewerContext', () => {
  it('starts closed', () => {
    const { result } = renderHook(() => useViewer(), { wrapper });
    expect(result.current.state.open).toBeNull();
    expect(result.current.state.totalPages).toBe(0);
    expect(result.current.state.driftGuardFired).toBe(false);
  });

  it('open() sets the document, page, and optional highlight', () => {
    const { result } = renderHook(() => useViewer(), { wrapper });
    act(() => result.current.open('doc-1', 4, HIGHLIGHT));
    expect(result.current.state.open).toEqual({
      documentId: 'doc-1',
      page: 4,
      highlight: HIGHLIGHT,
    });
  });

  it('open() defaults highlight to null when omitted', () => {
    const { result } = renderHook(() => useViewer(), { wrapper });
    act(() => result.current.open('doc-1', 1));
    expect(result.current.state.open?.highlight).toBeNull();
  });

  it('close() clears the open document', () => {
    const { result } = renderHook(() => useViewer(), { wrapper });
    act(() => result.current.open('doc-1', 1));
    act(() => result.current.close());
    expect(result.current.state.open).toBeNull();
  });

  it('setPage() updates the page and clears the highlight', () => {
    const { result } = renderHook(() => useViewer(), { wrapper });
    act(() => result.current.open('doc-1', 1, HIGHLIGHT));
    act(() => result.current.setPage(7));
    expect(result.current.state.open?.page).toBe(7);
    expect(result.current.state.open?.highlight).toBeNull();
  });

  it('throws when used outside the provider', () => {
    // Suppress the React error boundary console output during this assertion.
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect(() => renderHook(() => useViewer())).toThrow(
        /useViewer\* must be called inside <ViewerProvider>/,
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});
