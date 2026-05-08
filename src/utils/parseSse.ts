/**
 * Turns a `ReadableStream<Uint8Array>` into an `AsyncIterable<SseEvent>` by
 * splitting on `\n\n` event boundaries. Caller parses each event's `data` as
 * JSON.
 *
 * - Handles multi-line `data:` fields by joining them with `\n` (per the
 *   EventSource spec).
 * - Defaults the event name to `'message'` when no `event:` line is present.
 * - The reader is cancelled when the supplied `AbortSignal` aborts so the
 *   server-side connection closes promptly.
 */

export interface SseEvent {
  event: string;
  data: string;
}

const FIELD_DELIM = ':';
const NEWLINE = /\r?\n/;

const parseEventBlock = (raw: string): SseEvent | null => {
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of raw.split(NEWLINE)) {
    if (line === '' || line.startsWith(':')) continue;
    const colonIndex = line.indexOf(FIELD_DELIM);
    const field = colonIndex === -1 ? line : line.slice(0, colonIndex);
    const value =
      colonIndex === -1
        ? ''
        : line.slice(colonIndex + 1).replace(/^ /, '');
    if (field === 'event') {
      event = value;
    } else if (field === 'data') {
      dataLines.push(value);
    }
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join('\n') };
};

export const parseSse = async function* (
  stream: ReadableStream<Uint8Array>,
  signal: AbortSignal,
): AsyncIterable<SseEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  const onAbort = () => {
    reader.cancel().catch(() => {
      // swallow — caller drives the abort, the cancel is best-effort cleanup
    });
  };
  signal.addEventListener('abort', onAbort);

  try {
    while (true) {
      if (signal.aborted) return;
      const { value, done } = await reader.read();
      if (done) {
        const tail = buffer.trim();
        if (tail) {
          const event = parseEventBlock(tail);
          if (event) yield event;
        }
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      let match = buffer.match(/\r?\n\r?\n/);
      while (match && match.index !== undefined) {
        const block = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        const event = parseEventBlock(block);
        if (event) yield event;
        match = buffer.match(/\r?\n\r?\n/);
      }
    }
  } finally {
    signal.removeEventListener('abort', onAbort);
    reader.releaseLock();
  }
};
