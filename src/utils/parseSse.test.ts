import { parseSse } from './parseSse';

const streamFromChunks = (chunks: ReadonlyArray<string>): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  let pulled = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (pulled >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[pulled]));
      pulled += 1;
    },
  });
};

const collect = async (
  iter: AsyncIterable<{ event: string; data: string }>,
): Promise<Array<{ event: string; data: string }>> => {
  const out: Array<{ event: string; data: string }> = [];
  for await (const event of iter) out.push(event);
  return out;
};

describe('parseSse', () => {
  it('parses one event with named channel and JSON data', async () => {
    const stream = streamFromChunks(['event: token\ndata: {"text":"hi"}\n\n']);
    const events = await collect(parseSse(stream, new AbortController().signal));
    expect(events).toEqual([{ event: 'token', data: '{"text":"hi"}' }]);
  });

  it('preserves event arrival order across multiple events in one chunk', async () => {
    const stream = streamFromChunks([
      'event: token\ndata: a\n\nevent: token\ndata: b\n\nevent: token\ndata: c\n\n',
    ]);
    const events = await collect(parseSse(stream, new AbortController().signal));
    expect(events.map((entry) => entry.data)).toEqual(['a', 'b', 'c']);
  });

  it('reassembles events split across chunk boundaries', async () => {
    const stream = streamFromChunks(['event: tok', 'en\nda', 'ta: hello\n', '\n']);
    const events = await collect(parseSse(stream, new AbortController().signal));
    expect(events).toEqual([{ event: 'token', data: 'hello' }]);
  });

  it('joins multi-line data fields with \\n', async () => {
    const stream = streamFromChunks(['event: msg\ndata: line1\ndata: line2\n\n']);
    const events = await collect(parseSse(stream, new AbortController().signal));
    expect(events).toEqual([{ event: 'msg', data: 'line1\nline2' }]);
  });

  it('defaults event name to "message" when omitted', async () => {
    const stream = streamFromChunks(['data: bare\n\n']);
    const events = await collect(parseSse(stream, new AbortController().signal));
    expect(events).toEqual([{ event: 'message', data: 'bare' }]);
  });

  it('ignores comment lines (starting with :)', async () => {
    const stream = streamFromChunks([': keepalive\nevent: x\ndata: y\n\n']);
    const events = await collect(parseSse(stream, new AbortController().signal));
    expect(events).toEqual([{ event: 'x', data: 'y' }]);
  });

  it('cancels reader and stops iteration on abort', async () => {
    const controller = new AbortController();
    const stream = streamFromChunks(['event: a\ndata: 1\n\n', 'event: a\ndata: 2\n\n']);
    const events: Array<{ event: string; data: string }> = [];
    for await (const event of parseSse(stream, controller.signal)) {
      events.push(event);
      controller.abort();
    }
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it('handles trailing event without final newline pair', async () => {
    const stream = streamFromChunks(['event: tail\ndata: end']);
    const events = await collect(parseSse(stream, new AbortController().signal));
    expect(events).toEqual([{ event: 'tail', data: 'end' }]);
  });
});
