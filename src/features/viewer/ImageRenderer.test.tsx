import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { useReducer } from 'react';

import type { CitationRect } from '@shared/types';

const apiRaw = jest.fn();
jest.mock('../../hooks/useApiClient', () => ({
  useApiClient: () => ({
    get: jest.fn(),
    post: jest.fn(),
    del: jest.fn(),
    raw: apiRaw,
  }),
}));

const createObjectURL = jest.fn((blob: Blob) => `blob:img-${blob.size}-${blob.type}`);
const revokeObjectURL = jest.fn();

import { ImageRenderer } from './ImageRenderer';
import { INITIAL_VIEWER_STATE, viewerReducer } from './viewerReducer';

const buildImageStream = () =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3, 4]));
      controller.close();
    },
  });

const HIGHLIGHT: CitationRect = {
  page: 1,
  x: 10,
  y: 20,
  w: 80,
  h: 12,
  fileName: 'photo.png',
  marker: 1,
};

const setNaturalSize = (img: HTMLImageElement, width: number, height: number) => {
  Object.defineProperty(img, 'naturalWidth', { configurable: true, value: width });
  Object.defineProperty(img, 'naturalHeight', { configurable: true, value: height });
};

const Harness = ({
  documentId = 'photo.png',
  highlight = null,
}: {
  documentId?: string;
  highlight?: CitationRect | null;
}) => {
  const [, dispatch] = useReducer(viewerReducer, INITIAL_VIEWER_STATE);
  return <ImageRenderer documentId={documentId} highlight={highlight} dispatch={dispatch} />;
};

beforeEach(() => {
  apiRaw.mockReset();
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: createObjectURL,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: revokeObjectURL,
  });
  apiRaw.mockResolvedValue(
    new Response(buildImageStream(), {
      status: 200,
      headers: { 'content-type': 'image/png' },
    }),
  );
});

describe('ImageRenderer', () => {
  it('shows a loading spinner while fetching the image', () => {
    apiRaw.mockReturnValue(new Promise(() => undefined)); // never resolves
    render(<Harness />);
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument();
  });

  it('renders an <img> with a blob URL once the fetch resolves', async () => {
    render(<Harness />);
    const img = await screen.findByRole('img', { name: 'photo.png' });
    expect(img.getAttribute('src')).toMatch(/^blob:img-/);
  });

  it('encodes the documentId in the fetch path (defense-in-depth)', async () => {
    render(<Harness documentId="folder/with/slash.png" />);
    await waitFor(() => expect(apiRaw).toHaveBeenCalled());
    expect(apiRaw.mock.calls[0][0]).toBe('/documents/folder%2Fwith%2Fslash.png/content');
  });

  it('shows no highlight overlay until the image natural dimensions are known', async () => {
    render(<Harness highlight={HIGHLIGHT} />);
    await screen.findByRole('img', { name: 'photo.png' });
    expect(screen.queryByTestId('citation-highlight')).toBeNull();
  });

  it('publishes the synthetic viewport on image load and renders highlight at pixel coords', async () => {
    render(<Harness highlight={HIGHLIGHT} />);
    const img = await screen.findByRole('img', { name: 'photo.png' });
    setNaturalSize(img as HTMLImageElement, 1000, 1000);
    fireEvent.load(img);
    const overlay = await screen.findByTestId('citation-highlight');
    // scale=1, so coords are passed through verbatim
    expect(overlay.style.left).toBe('10px');
    expect(overlay.style.top).toBe('20px');
    expect(overlay.style.width).toBe('80px');
    expect(overlay.style.height).toBe('12px');
  });

  it('rejects highlights taller than the image (drift guard)', async () => {
    // Drift-guard threshold is 1.0 (DRIFT_GUARD_MAX_PAGE_FRACTION in
    // shared/types/viewer.ts) — raised from 0.25 → 1.0 since slice 5 was
    // first authored to pass through API-supplied bounds while the server's
    // citation pipeline emits page-sized rects. Use a height that exceeds
    // the image's natural height to actually trip the guard.
    const tall: CitationRect = { ...HIGHLIGHT, h: 1100 }; // 110% of 1000
    render(<Harness highlight={tall} />);
    const img = await screen.findByRole('img', { name: 'photo.png' });
    setNaturalSize(img as HTMLImageElement, 1000, 1000);
    fireEvent.load(img);
    await waitFor(() =>
      expect(screen.queryByTestId('citation-highlight')).toBeNull(),
    );
  });

  it('falls back gracefully when the response has no body (older browser/test envs)', async () => {
    apiRaw.mockResolvedValue(
      new Response(new ArrayBuffer(8), {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      }),
    );
    render(<Harness documentId="photo.jpg" />);
    const img = await screen.findByRole('img', { name: 'photo.jpg' });
    expect(img.getAttribute('src')).toMatch(/^blob:/);
  });

  it('passes axe in the loaded state', async () => {
    const { container } = render(<Harness highlight={HIGHLIGHT} />);
    const img = await screen.findByRole('img', { name: 'photo.png' });
    setNaturalSize(img as HTMLImageElement, 800, 600);
    fireEvent.load(img);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
