import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';

import type { Citation, IndexerHandle } from '@shared/types';

// Avoid pulling DocumentViewer (and its msalInstance dependency chain) into
// this hook test — import the provider directly from its module.
import { ViewerProvider, useViewer } from '../viewer/ViewerContext';

import { useCitationClick } from './useCitationClick';

const revealDocument = jest.fn();

jest.mock('../indexer-host', () => ({
  useIndexerRef: () => ({
    current: {
      selectCollection: () => undefined,
      revealDocument,
    } satisfies IndexerHandle,
  }),
}));

const CITATION: Citation = {
  marker: 1,
  page: 7,
  x: 10,
  y: 20,
  w: 100,
  h: 12,
  fileName: 'master-agreement.pdf',
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <ViewerProvider>{children}</ViewerProvider>
);

describe('useCitationClick', () => {
  beforeEach(() => {
    revealDocument.mockClear();
  });

  it('opens the viewer at the cited page with the highlight rect', () => {
    const { result } = renderHook(
      () => {
        const click = useCitationClick();
        const viewer = useViewer();
        return { click, viewer };
      },
      { wrapper },
    );

    act(() => result.current.click(CITATION));

    expect(result.current.viewer.state.open).toEqual({
      documentId: 'master-agreement.pdf',
      page: 7,
      highlight: {
        page: 7,
        x: 10,
        y: 20,
        w: 100,
        h: 12,
        fileName: 'master-agreement.pdf',
        marker: 1,
      },
    });
  });

  it('calls indexerRef.revealDocument with the resolved documentId', () => {
    const { result } = renderHook(() => useCitationClick(), { wrapper });
    act(() => result.current(CITATION));
    expect(revealDocument).toHaveBeenCalledWith('master-agreement.pdf');
  });
});
