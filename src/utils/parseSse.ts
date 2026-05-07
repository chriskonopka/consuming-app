/**
 * What belongs here: turns a `ReadableStream<Uint8Array>` into an
 * `AsyncIterable<{ event: string; data: string }>` by splitting on `\n\n`
 * event boundaries. Caller parses each event's `data` as JSON.
 *
 * Scaffolded — implementation lands in slice 3.
 */

export interface SseEvent {
  event: string;
  data: string;
}

export const parseSse = async function* (
  _stream: ReadableStream<Uint8Array>,
  _signal: AbortSignal,
): AsyncIterable<SseEvent> {
  // slice 3 — yields events as they arrive from the stream
  yield* [];
};
