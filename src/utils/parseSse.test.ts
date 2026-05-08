import { parseSse, type SseEvent } from './parseSse';

const encoder = new TextEncoder();

const streamFromChunks = (chunks: string[]): ReadableStream<Uint8Array> =>
  new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

const collect = async (
  stream: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): Promise<SseEvent[]> => {
  const events: SseEvent[] = [];
  for await (const event of parseSse(stream, signal ?? new AbortController().signal)) {
    events.push(event);
  }
  return events;
};

describe('parseSse', () => {
  it('parses a single token event', async () => {
    const stream = streamFromChunks([
      'event: token\n',
      'data: {"text":"Hello"}\n',
      '\n',
    ]);
    const events = await collect(stream);
    expect(events).toEqual([{ event: 'token', data: '{"text":"Hello"}' }]);
  });

  it('parses multiple events in a single chunk', async () => {
    const stream = streamFromChunks([
      'event: token\ndata: {"text":"Hi"}\n\nevent: token\ndata: {"text":" there"}\n\n',
    ]);
    const events = await collect(stream);
    expect(events.map((e) => e.event)).toEqual(['token', 'token']);
    expect(JSON.parse(events[0].data)).toEqual({ text: 'Hi' });
    expect(JSON.parse(events[1].data)).toEqual({ text: ' there' });
  });

  it('handles split chunks across event boundaries', async () => {
    const stream = streamFromChunks([
      'event: token\ndata: {"te',
      'xt":"split"}\n\n',
    ]);
    const events = await collect(stream);
    expect(events).toEqual([{ event: 'token', data: '{"text":"split"}' }]);
  });

  it('parses citation and error event types', async () => {
    const stream = streamFromChunks([
      'event: citation\ndata: {"marker":1,"page":1}\n\n',
      'event: error\ndata: {"message":"oops"}\n\n',
    ]);
    const events = await collect(stream);
    expect(events.map((e) => e.event)).toEqual(['citation', 'error']);
  });

  it('skips comment lines', async () => {
    const stream = streamFromChunks([
      ': keep-alive ping\n',
      'event: token\ndata: {"text":"x"}\n\n',
    ]);
    const events = await collect(stream);
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('token');
  });

  it('joins multi-line data fields with newlines', async () => {
    const stream = streamFromChunks([
      'event: error\ndata: line one\ndata: line two\n\n',
    ]);
    const events = await collect(stream);
    expect(events[0].data).toBe('line one\nline two');
  });

  it('aborts when signal is cancelled', async () => {
    const controller = new AbortController();
    const stream = streamFromChunks([
      'event: token\ndata: {"text":"a"}\n\n',
    ]);
    controller.abort();
    const events = await collect(stream, controller.signal);
    expect(events).toEqual([]);
  });
});
