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

  it('fires onStaleConversation once on 404 and suppresses the public error', async () => {
    // 404 means the cached conversationId points to a conversation that was
    // deleted; recovery is to drop the id and let the next send lazy-create.
    fetchMock.mockResolvedValueOnce(
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

    await waitFor(() => expect(onStaleConversation).toHaveBeenCalledTimes(1));
    expect(onStaleDocset).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
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
