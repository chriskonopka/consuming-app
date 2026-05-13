jest.mock('../../auth/msalInstance');

const apiRaw = jest.fn();
jest.mock('../../hooks/useApiClient', () => ({
  useApiClient: () => ({
    get: jest.fn(),
    post: jest.fn(),
    del: jest.fn(),
    raw: apiRaw,
  }),
}));

import { act, renderHook, waitFor } from '@testing-library/react';

import { useDownloadDocument } from './useDownloadDocument';

describe('useDownloadDocument', () => {
  beforeEach(() => {
    apiRaw.mockReset();
    (URL.createObjectURL as jest.Mock).mockClear?.();
    (URL.revokeObjectURL as jest.Mock).mockClear?.();
  });

  it('fetches /content with the documentId, builds a blob, triggers anchor click, and revokes the blob URL', async () => {
    const bytes = new Uint8Array([7, 8, 9]);
    apiRaw.mockResolvedValue(
      new Response(bytes.buffer, {
        status: 200,
        headers: { 'content-type': 'application/pdf' },
      }),
    );
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    const { result } = renderHook(() => useDownloadDocument());

    await act(async () => {
      await result.current.download('doc-abc', 'report.pdf');
    });

    expect(apiRaw).toHaveBeenCalledWith('/documents/doc-abc/content');
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('idle');
    click.mockRestore();
  });

  it('falls back to "document.bin" when no filename is provided (avoids embedding the documentId GUID)', async () => {
    apiRaw.mockResolvedValue(
      new Response(new ArrayBuffer(0), { status: 200, headers: { 'content-type': 'application/pdf' } }),
    );
    // Spy on the anchor's `download` attribute by intercepting createElement.
    let observedDownload = '';
    const originalCreate = document.createElement.bind(document);
    const createSpy = jest
      .spyOn(document, 'createElement')
      .mockImplementation((tag: string) => {
        const element = originalCreate(tag);
        if (tag === 'a') {
          const anchor = element as HTMLAnchorElement;
          const originalClick = anchor.click.bind(anchor);
          anchor.click = () => {
            observedDownload = anchor.download;
            originalClick();
          };
        }
        return element;
      });
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    const { result } = renderHook(() => useDownloadDocument());
    await act(async () => {
      await result.current.download('doc-1', null);
    });

    expect(observedDownload).toBe('document.bin');
    createSpy.mockRestore();
    click.mockRestore();
  });

  it('sets status to "error" and does NOT trigger a download on non-OK responses', async () => {
    apiRaw.mockResolvedValue(new Response('nope', { status: 500 }));
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    const { result } = renderHook(() => useDownloadDocument());
    await act(async () => {
      await result.current.download('doc-1', 'whatever.pdf');
    });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(click).not.toHaveBeenCalled();
    click.mockRestore();
  });

  it('sets status to "error" on a thrown network exception', async () => {
    apiRaw.mockRejectedValue(new TypeError('NetworkError'));

    const { result } = renderHook(() => useDownloadDocument());
    await act(async () => {
      await result.current.download('doc-1', 'x.pdf');
    });

    await waitFor(() => expect(result.current.status).toBe('error'));
  });
});
