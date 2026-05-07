/**
 * What belongs here: convert a `ReadableStream<Uint8Array>` (or a Blob) into
 * an object URL suitable for `<img src=...>`. Caller is responsible for
 * `URL.revokeObjectURL` when the resource is no longer needed.
 *
 * Scaffolded — implementation lands in slice 5 (image rendering in viewer).
 */

export const bytesToBlobUrl = async (
  source: ReadableStream<Uint8Array> | Blob,
): Promise<string> => {
  if (source instanceof Blob) return URL.createObjectURL(source);
  // Slice 5: read the stream into a Uint8Array, wrap in Blob, return object URL.
  throw new Error('bytesToBlobUrl: stream path not implemented in scaffold — landed in slice 5.');
};
