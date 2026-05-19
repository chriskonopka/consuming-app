/**
 * Convert a `ReadableStream<Uint8Array>` (or a Blob) into an object URL
 * suitable for `<img src=...>`.
 *
 * Why a blob URL: `<img>` can't carry an `Authorization: Bearer …` header,
 * but the API requires it (REQUIREMENTS.md §5.5). The image is fetched via
 * `useApiClient.raw()` (which adds the auth header) and the response body is
 * converted here to a same-origin object URL the `<img>` element can render.
 *
 * Caller is responsible for `URL.revokeObjectURL` when the resource is no
 * longer needed (typically in a `useEffect` cleanup) — leaking object URLs
 * pins the underlying bytes in memory until the page unloads.
 *
 * Optional `contentType`: when provided, becomes the resulting Blob's MIME
 * type so the `<img>` element receives the correct content-type metadata.
 */

export const bytesToBlobUrl = async (
  source: ReadableStream<Uint8Array> | Blob,
  contentType?: string,
): Promise<string> => {
  if (source instanceof Blob) {
    if (contentType && source.type !== contentType) {
      return URL.createObjectURL(new Blob([source], { type: contentType }));
    }
    return URL.createObjectURL(source);
  }

  const reader = source.getReader();
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const blob = new Blob(chunks, contentType ? { type: contentType } : undefined);
  return URL.createObjectURL(blob);
};
