/**
 * Turns a `ReadableStream<Uint8Array>` into an `AsyncIterable<SseEvent>` by
 * parsing event-stream framing (`event:`, `data:`, blank-line terminator).
 * Caller parses each event's `data` as JSON.
 *
 * Spec: https://html.spec.whatwg.org/multipage/server-sent-events.html#parsing-an-event-stream
 * — we implement the subset the API actually uses (event + data, no id, no retry).
 */

export interface SseEvent {
  event: string;
  data: string;
}

const decoder = new TextDecoder();

export const parseSse = async function* (
  stream: ReadableStream<Uint8Array>,
  signal: AbortSignal,
): AsyncIterable<SseEvent> {
  const reader = stream.getReader();
  let buffer = '';
  let event = 'message';
  let data = '';
  try {
    while (true) {
      if (signal.aborted) {
        await reader.cancel();
        return;
      }
      const { value, done } = await reader.read();
      if (done) {
        if (data.length > 0) yield { event, data };
        return;
      }
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
        const rawLine = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;

        if (line === '') {
          if (data.length > 0) {
            yield { event, data };
          }
          event = 'message';
          data = '';
          continue;
        }

        if (line.startsWith(':')) continue;

        const colonIdx = line.indexOf(':');
        const field = colonIdx === -1 ? line : line.slice(0, colonIdx);
        const value =
          colonIdx === -1 ? '' : line.slice(colonIdx + 1).replace(/^ /, '');

        if (field === 'event') {
          event = value || 'message';
        } else if (field === 'data') {
          data = data.length === 0 ? value : `${data}\n${value}`;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
};
