import { renderHook, waitFor } from '@testing-library/react';

const apiRaw = jest.fn();
jest.mock('../../hooks/useApiClient', () => ({
  useApiClient: () => ({
    get: jest.fn(),
    post: jest.fn(),
    del: jest.fn(),
    raw: apiRaw,
  }),
}));

const trackException = jest.fn();
jest.mock('../../appInsights', () => ({
  appInsights: { trackException },
}));

import { useImageDocument } from './useImageDocument';

const createObjectURL = jest.fn((blob: Blob) => `blob:${blob.size}-${blob.type}`);
const revokeObjectURL = jest.fn();

beforeEach(() => {
  apiRaw.mockReset();
  trackException.mockClear();
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
});

const buildStream = () =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3]));
      controller.close();
    },
  });

describe('useImageDocument', () => {
  it('returns idle when no documentId is supplied', () => {
    const { result } = renderHook(() => useImageDocument(null));
    expect(result.current.status).toBe('idle');
    expect(result.current.url).toBeNull();
  });

  it('fetches the image and exposes a blob URL', async () => {
    apiRaw.mockResolvedValue(
      new Response(buildStream(), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }),
    );
    const { result } = renderHook(() => useImageDocument('photo.png'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.url).toMatch(/^blob:/);
    expect(apiRaw).toHaveBeenCalledWith(
      '/documents/photo.png/content',
      expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it('encodes the documentId path segment (defense-in-depth)', async () => {
    apiRaw.mockResolvedValue(
      new Response(buildStream(), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }),
    );
    renderHook(() => useImageDocument('a/b/c.png'));
    await waitFor(() => expect(apiRaw).toHaveBeenCalled());
    expect(apiRaw.mock.calls[0][0]).toBe('/documents/a%2Fb%2Fc.png/content');
  });

  it('reports error status without leaking documentId into telemetry', async () => {
    apiRaw.mockResolvedValue(new Response('not found', { status: 404 }));
    const { result } = renderHook(() => useImageDocument('missing.png'));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(trackException).toHaveBeenCalled();
    const call = trackException.mock.calls[0][0];
    expect(call.properties).toEqual({ stage: 'image-load' });
    // documentId / fileName must not appear in properties
    expect(JSON.stringify(call.properties)).not.toContain('missing.png');
  });

  it('falls back to arrayBuffer when the response has no body', async () => {
    apiRaw.mockResolvedValue(
      new Response(new ArrayBuffer(8), {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      }),
    );
    const { result } = renderHook(() => useImageDocument('photo.jpg'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.url).toMatch(/^blob:/);
  });

  it('revokes the previous blob URL when documentId changes', async () => {
    apiRaw.mockResolvedValue(
      new Response(buildStream(), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }),
    );
    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => useImageDocument(id),
      { initialProps: { id: 'a.png' } },
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    revokeObjectURL.mockClear();
    rerender({ id: 'b.png' });
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalled());
  });

  it('does not surface error telemetry when the request is aborted (unmount)', async () => {
    let abortSignal: AbortSignal | undefined;
    apiRaw.mockImplementation((_url: string, init?: RequestInit) => {
      abortSignal = init?.signal as AbortSignal;
      return new Promise((_resolve, reject) => {
        abortSignal?.addEventListener('abort', () =>
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
        );
      });
    });
    const { unmount } = renderHook(() => useImageDocument('photo.png'));
    unmount();
    // Give microtasks a tick to settle the rejected promise.
    await Promise.resolve();
    expect(trackException).not.toHaveBeenCalled();
  });
});
