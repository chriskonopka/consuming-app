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
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import { MsalAppProvider } from '../../auth/MsalAppProvider';

import { useChatHistory } from './useChatHistory';

const msalMock = jest.requireMock('../../auth/msalInstance');

const wrap = (children: ReactNode) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MsalAppProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MsalAppProvider>
  );
};

describe('useChatHistory stale-ref self-heal', () => {
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

  it('fires onStaleConversation once on persistent 404 (after retry) and suppresses the public error', async () => {
    // 404 means the cached conversationId points to a conversation that was
    // deleted; recovery is to drop the id and let the next send lazy-create.
    // The hook retries 404 up to 3 times with backoff (post-stream blob
    // flush lag) — return 404 on every attempt so we hit the truly-stale path.
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'https://problems.api/not-found',
          title: 'Not Found',
          status: 404,
          detail: 'Conversation not found.',
        }),
        { status: 404, headers: { 'content-type': 'application/problem+json' } },
      ),
    );

    const onStaleConversation = jest.fn();
    const onStaleDocset = jest.fn();
    const { result } = renderHook(
      () => useChatHistory('col-1', 'conv-stale', { onStaleConversation, onStaleDocset }),
      { wrapper: ({ children }) => wrap(children) },
    );

    // Allow time for the retry sequence: 500 + 1000 + 2000 = 3500ms backoff.
    await waitFor(
      () => expect(onStaleConversation).toHaveBeenCalledTimes(1),
      { timeout: 6000 },
    );
    expect(onStaleDocset).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it('does not fire onStaleConversation if a retry succeeds (post-stream blob flush lag)', async () => {
    // Simulate the post-STREAM_ENDED race: first /history attempt 404s
    // because the server hasn't flushed the blob yet, the retry succeeds.
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            type: 'https://problems.api/not-found',
            title: 'Not Found',
            status: 404,
            detail: 'Not yet.',
          }),
          { status: 404, headers: { 'content-type': 'application/problem+json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            conversationId: 'conv-1',
            totalMessages: 2,
            messages: [
              {
                id: 'm1',
                role: 'user',
                content: 'hi',
                timestamp: '',
                llmProvider: null,
                citations: null,
              },
              {
                id: 'm2',
                role: 'assistant',
                content: 'hello',
                timestamp: '',
                llmProvider: 'Claude',
                citations: null,
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

    const onStaleConversation = jest.fn();
    const { result } = renderHook(
      () => useChatHistory('col-1', 'conv-1', { onStaleConversation }),
      { wrapper: ({ children }) => wrap(children) },
    );

    await waitFor(() => expect(result.current.messages.length).toBe(2), { timeout: 6000 });
    expect(onStaleConversation).not.toHaveBeenCalled();
  });

  it('returns a referentially stable messages array across re-renders when the cached payload is unchanged', async () => {
    // Guards against MessageList's tail-scroll effect re-firing on every
    // ancestor render — clicking a citation must not snap the chat to the
    // bottom because the viewer reducer happens to re-render the subtree.
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          conversationId: 'conv-1',
          totalMessages: 1,
          messages: [
            {
              id: 'm1',
              role: 'user',
              content: 'hi',
              timestamp: '',
              llmProvider: null,
              citations: null,
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    // Stable QueryClient across rerenders — the default `wrap` helper mints a
    // fresh client per call, which would flush the cache and defeat the test.
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const stableWrapper = ({ children }: { children: ReactNode }) => (
      <MsalAppProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </MsalAppProvider>
    );

    const { result, rerender } = renderHook(() => useChatHistory('col-1', 'conv-1'), {
      wrapper: stableWrapper,
    });

    await waitFor(() => expect(result.current.messages.length).toBe(1));
    const first = result.current.messages;
    rerender();
    rerender();
    expect(result.current.messages).toBe(first);
  });

  it('fires onStaleDocset once on 403 and suppresses the public error', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          type: 'https://problems.api/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: 'Access to the document set is denied.',
        }),
        { status: 403, headers: { 'content-type': 'application/problem+json' } },
      ),
    );

    const onStaleConversation = jest.fn();
    const onStaleDocset = jest.fn();
    const { result } = renderHook(
      () => useChatHistory('col-stale', 'conv-1', { onStaleConversation, onStaleDocset }),
      { wrapper: ({ children }) => wrap(children) },
    );

    await waitFor(() => expect(onStaleDocset).toHaveBeenCalledTimes(1));
    expect(onStaleConversation).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });
});
