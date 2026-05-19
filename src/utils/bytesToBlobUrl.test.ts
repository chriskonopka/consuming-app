import { bytesToBlobUrl } from './bytesToBlobUrl';

describe('bytesToBlobUrl', () => {
  const mockCreateObjectURL = jest.fn((blob: Blob) => `blob:mock-${blob.size}-${blob.type}`);
  const originalCreate = URL.createObjectURL;

  beforeEach(() => {
    mockCreateObjectURL.mockClear();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: mockCreateObjectURL,
    });
  });

  afterAll(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: originalCreate,
    });
  });

  it('returns an object URL for a Blob input as-is when no contentType is supplied', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
    const url = await bytesToBlobUrl(blob);
    expect(url).toBe('blob:mock-3-image/png');
    expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
    expect(mockCreateObjectURL).toHaveBeenCalledWith(blob);
  });

  it('rewraps a Blob when contentType differs from the source type', async () => {
    const blob = new Blob([new Uint8Array([7, 7])], { type: 'application/octet-stream' });
    const url = await bytesToBlobUrl(blob, 'image/jpeg');
    expect(url).toBe('blob:mock-2-image/jpeg');
    const wrapped = mockCreateObjectURL.mock.calls[0][0];
    expect(wrapped).not.toBe(blob);
    expect(wrapped.type).toBe('image/jpeg');
  });

  it('does NOT rewrap when the Blob already carries the requested content type', async () => {
    const blob = new Blob([new Uint8Array([9])], { type: 'image/png' });
    await bytesToBlobUrl(blob, 'image/png');
    expect(mockCreateObjectURL).toHaveBeenCalledWith(blob);
  });

  it('reads a stream into a Blob and returns an object URL', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        controller.enqueue(new Uint8Array([3, 4, 5]));
        controller.close();
      },
    });
    const url = await bytesToBlobUrl(stream, 'image/png');
    expect(url).toBe('blob:mock-5-image/png');
    const blob = mockCreateObjectURL.mock.calls[0][0];
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBe(5);
  });

  it('handles an empty stream by returning an empty Blob URL', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });
    const url = await bytesToBlobUrl(stream);
    expect(url).toMatch(/^blob:mock-0/);
  });

  it('skips undefined chunks defensively', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([42]));
        controller.close();
      },
    });
    const url = await bytesToBlobUrl(stream, 'image/jpeg');
    expect(url).toBe('blob:mock-1-image/jpeg');
  });

  it('rejects when the stream errors mid-read', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1]));
        controller.error(new Error('boom'));
      },
    });
    await expect(bytesToBlobUrl(stream)).rejects.toThrow('boom');
  });
});
