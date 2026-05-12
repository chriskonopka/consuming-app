jest.mock('../../auth/msalInstance');
jest.mock('../../config/env', () => ({
  config: {
    apiBaseUrl: 'https://api.test',
    indexerRemoteUrl: 'http://localhost:9998',
    msalClientId: 'cid',
    msalAuthority: 'auth',
    msalApiScope: 'scope',
    appInsightsConnectionString: '',
  },
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useReducer } from 'react';

import { MsalAppProvider } from '../../auth/MsalAppProvider';

import { buildInitialChatSession, chatReducer, type ChatAction } from './chatReducer';
import { useSseChat, type UseSseChatCallbacks } from './useSseChat';

const msalMock = jest.requireMock('../../auth/msalInstance');

const sseResponse = (chunks: string[]): Response => {
  const encoder = new TextEncoder();
  let pulled = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (pulled >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[pulled]));
      pulled += 1;
    },
  });
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'text/event-stream' }),
    body: stream,
  } as unknown as Response;
};

const wrap = (children: ReactNode) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MsalAppProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MsalAppProvider>
  );
};

const callbacksFor = (): UseSseChatCallbacks & {
  pre: jest.Mock;
  mid: jest.Mock;
  tooLong: jest.Mock;
  selectionTooLarge: jest.Mock;
} => {
  const pre = jest.fn();
  const mid = jest.fn();
  const tooLong = jest.fn();
  const selectionTooLarge = jest.fn();
  return {
    onPreStreamError: pre,
    onStreamError: mid,
    onContentTooLong: tooLong,
    onSelectionTooLarge: selectionTooLarge,
    pre,
    mid,
    tooLong,
    selectionTooLarge,
  };
};

const renderSseHook = (
  callbacks: UseSseChatCallbacks,
  selection?: { documentIds: string[]; folderIds: string[] },
) =>
  renderHook(
    () => {
      const [state, dispatch] = useReducer(chatReducer, 'col-1', buildInitialChatSession);
      const sse = useSseChat({ state, dispatch, callbacks, selection });
      return { sse, state, dispatch };
    },
    { wrapper: ({ children }) => wrap(children) },
  );

describe('useSseChat', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    msalMock.__resetMsalMock();
    msalMock.msalInstance.getActiveAccount.mockReturnValue({
      homeAccountId: 'h',
      username: 'u@e',
      name: 'U',
    });
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('rejects content above 64 KB before any fetch', async () => {
    const cbs = callbacksFor();
    const { result } = renderSseHook(cbs);
    const big = 'a'.repeat(64 * 1024 + 1);
    await act(async () => {
      await result.current.sse.send(big);
    });
    expect(cbs.tooLong).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does nothing on empty/whitespace-only input', async () => {
    const cbs = callbacksFor();
    const { result } = renderSseHook(cbs);
    await act(async () => {
      await result.current.sse.send('   \n  ');
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(cbs.tooLong).not.toHaveBeenCalled();
    expect(cbs.pre).not.toHaveBeenCalled();
  });

  it('creates conversation with Content-Type: application/json and {} body', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          conversationId: 'c-1',
          documentSetId: 'col-1',
          userId: 'u',
          title: '',
          messageCount: 0,
          lastMessageAt: null,
          createdAt: '',
          updatedAt: '',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    fetchMock.mockResolvedValueOnce(sseResponse([]));

    const cbs = callbacksFor();
    const { result } = renderSseHook(cbs);
    await act(async () => {
      await result.current.sse.send('hello');
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/document-sets/col-1/conversations');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).body).toBe('{}');
    const headers = (init as RequestInit).headers as Headers;
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('surfaces ensure-conversation failure as pre-stream error', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          type: 'https://problems.api/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: 'Cannot create conversation',
        }),
        {
          status: 403,
          headers: { 'content-type': 'application/problem+json' },
        },
      ),
    );

    const cbs = callbacksFor();
    const { result } = renderSseHook(cbs);
    await act(async () => {
      await result.current.sse.send('hello');
    });
    expect(cbs.pre).toHaveBeenCalledWith('Cannot create conversation');
  });

  it('treats network failure on send as pre-stream error', async () => {
    // ensureConversation succeeds
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            conversationId: 'c-1',
            documentSetId: 'col-1',
            userId: 'u',
            title: '',
            messageCount: 0,
            lastMessageAt: null,
            createdAt: '',
            updatedAt: '',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockRejectedValueOnce(new TypeError('NetworkError'));

    const cbs = callbacksFor();
    const { result } = renderSseHook(cbs);
    await act(async () => {
      await result.current.sse.send('hello');
    });
    await waitFor(() =>
      expect(cbs.pre).toHaveBeenCalledWith('Network error — check your connection and retry.'),
    );
  });

  it('treats abort during fetch as STREAM_ABORTED, not error', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            conversationId: 'c-1',
            documentSetId: 'col-1',
            userId: 'u',
            title: '',
            messageCount: 0,
            lastMessageAt: null,
            createdAt: '',
            updatedAt: '',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockImplementationOnce(
        (_, init?: RequestInit) =>
          new Promise<Response>((_, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('aborted', 'AbortError'));
            });
          }),
      );

    const cbs = callbacksFor();
    const { result } = renderSseHook(cbs);
    let sendPromise!: Promise<void>;
    await act(async () => {
      sendPromise = result.current.sse.send('hello');
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
    });
    await act(async () => {
      result.current.sse.abort();
      await sendPromise;
    });
    expect(cbs.pre).not.toHaveBeenCalled();
    expect(cbs.mid).not.toHaveBeenCalled();
  });

  it('treats event: text_chunk as a token (API contract drift)', async () => {
    // The contract documents `event: token` for assistant text frames but the
    // deployed API emits `event: text_chunk`. Without this branch in the
    // client, every chunk was silently dropped — the optimistic user bubble
    // appeared and then vanished on STREAM_ENDED with no assistant reply.
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            conversationId: 'c-1',
            documentSetId: 'col-1',
            userId: 'u',
            title: '',
            messageCount: 0,
            lastMessageAt: null,
            createdAt: '',
            updatedAt: '',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        sseResponse([
          'event: text_chunk\ndata: {"text":"Hello"}\n\n',
          'event: text_chunk\ndata: {"text":" world"}\n\n',
        ]),
      );

    const dispatched: ChatAction[] = [];
    const cbs = callbacksFor();
    const { result } = renderHook(
      () => {
        const [state, baseDispatch] = useReducer(chatReducer, 'col-1', buildInitialChatSession);
        const dispatch = (action: ChatAction) => {
          dispatched.push(action);
          baseDispatch(action);
        };
        const sse = useSseChat({ state, dispatch, callbacks: cbs });
        return { sse };
      },
      { wrapper: ({ children }) => wrap(children) },
    );

    await act(async () => {
      await result.current.sse.send('hi');
    });

    const tokens = dispatched.filter((action) => action.type === 'STREAM_TOKEN');
    expect(tokens).toEqual([
      { type: 'STREAM_TOKEN', text: 'Hello' },
      { type: 'STREAM_TOKEN', text: ' world' },
    ]);
    expect(cbs.pre).not.toHaveBeenCalled();
  });

  it('streams tokens and citations and ends cleanly', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            conversationId: 'c-1',
            documentSetId: 'col-1',
            userId: 'u',
            title: '',
            messageCount: 0,
            lastMessageAt: null,
            createdAt: '',
            updatedAt: '',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        sseResponse([
          'event: token\ndata: {"text":"Hello"}\n\n',
          'event: citation\ndata: {"marker":1,"page":1,"x":1,"y":2,"w":3,"h":4,"documentId":"doc-f","fileName":"f.pdf"}\n\n',
        ]),
      );

    const cbs = callbacksFor();
    const { result } = renderSseHook(cbs);
    await act(async () => {
      await result.current.sse.send('hi');
    });

    await waitFor(() => {
      expect(cbs.pre).not.toHaveBeenCalled();
    });
  });

  it('forwards selection arrays in the messages body and omits when empty', async () => {
    fetchMock
      // conversation create
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            conversationId: 'c-1',
            documentSetId: 'col-1',
            userId: 'u',
            title: '',
            messageCount: 0,
            lastMessageAt: null,
            createdAt: '',
            updatedAt: '',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      // messages SSE
      .mockResolvedValueOnce(sseResponse(['event: token\ndata: {"text":"hi"}\n\n']));

    const cbs = callbacksFor();
    const { result } = renderSseHook(cbs, {
      documentIds: ['doc-a', 'doc-b'],
      folderIds: [],
    });

    await act(async () => {
      await result.current.sse.send('question');
    });

    const messagesCall = fetchMock.mock.calls.find(([url]: [string]) => url.endsWith('/messages'));
    expect(messagesCall).toBeDefined();
    const body = JSON.parse(messagesCall![1].body as string);
    expect(body.documentIds).toEqual(['doc-a', 'doc-b']);
    expect(body.folderIds).toBeUndefined();
  });

  it('rejects sends when selection arrays exceed the per-array cap', async () => {
    const cbs = callbacksFor();
    const overflow = Array.from({ length: 65 }, (_, idx) => `doc-${idx}`);
    const { result } = renderSseHook(cbs, { documentIds: overflow, folderIds: [] });
    await act(async () => {
      await result.current.sse.send('hi');
    });
    expect(cbs.selectionTooLarge).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
