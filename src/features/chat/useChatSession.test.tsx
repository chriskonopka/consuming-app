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

import { MsalAppProvider } from '../../auth/MsalAppProvider';

import { useChatSession } from './useChatSession';

const msalMock = jest.requireMock('../../auth/msalInstance');

const wrap = (children: ReactNode) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return (
    <MsalAppProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MsalAppProvider>
  );
};

const emptyListResponse = () =>
  new Response(
    JSON.stringify({ items: [], totalCount: 0, page: 1, pageSize: 1 }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

describe('useChatSession', () => {
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

  it('does NOT clobber a locally-set conversationId when /list is stale-null and streaming flips back to idle', async () => {
    // Regression for: each chat send creating a brand-new conversation.
    // Reproduction: /list returns empty on mount (no prior conversations),
    // useSseChat lazy-creates a conversation and dispatches
    // CONVERSATION_RESOLVED(<new-id>), the user's stream ends so
    // state.streaming flips back to null, and this hook's sync effect fires
    // again. /list's cached response is still the empty mount-time payload,
    // so a naive dispatch would set state.conversationId back to null —
    // making the next send create yet another fresh conversation.
    fetchMock.mockResolvedValue(emptyListResponse());

    const { result } = renderHook(() => useChatSession('col-1'), {
      wrapper: ({ children }) => wrap(children),
    });

    // Wait for the initial /list to resolve so the effect has had a chance
    // to dispatch CONVERSATION_RESOLVED(null) on the empty result.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(result.current?.state.conversationId).toBeNull();

    // Simulate `useSseChat.ensureConversation` lazy-creating a conversation.
    act(() => {
      result.current?.dispatch({
        type: 'CONVERSATION_RESOLVED',
        conversationId: 'new-conv-id',
      });
    });
    expect(result.current?.state.conversationId).toBe('new-conv-id');

    // Simulate STREAM_STARTED → STREAM_ENDED (state.streaming flips
    // non-null then back to null). The bug: the sync effect re-fires when
    // streaming flips and clobbers with the stale /list null.
    act(() => {
      result.current?.dispatch({
        type: 'STREAM_STARTED',
        userMessageId: 'u',
        userMessageText: 'hi',
        conversationId: 'new-conv-id',
        abortController: new AbortController(),
        now: 0,
      });
    });
    act(() => {
      result.current?.dispatch({ type: 'STREAM_ENDED' });
    });

    // The locally-set conversationId must survive — /list's stale null
    // should not overwrite it.
    expect(result.current?.state.conversationId).toBe('new-conv-id');
  });
});
