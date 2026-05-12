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

import { useConversation } from './useConversation';

const msalMock = jest.requireMock('../../auth/msalInstance');

const wrap = (children: ReactNode) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MsalAppProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MsalAppProvider>
  );
};

describe('useConversation stale-ref self-heal', () => {
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

  it.each([
    [403, 'Forbidden', 'forbidden'],
    [404, 'Not Found', 'not-found'],
  ] as const)(
    'fires onStaleDocset once on %s and suppresses the public error',
    async (status, title, slug) => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            type: `https://problems.api/${slug}`,
            title,
            status,
            detail: 'Access denied.',
          }),
          { status, headers: { 'content-type': 'application/problem+json' } },
        ),
      );

      const onStaleDocset = jest.fn();
      const { result } = renderHook(
        () => useConversation('col-stale', { onStaleDocset }),
        { wrapper: ({ children }) => wrap(children) },
      );

      await waitFor(() => expect(onStaleDocset).toHaveBeenCalledTimes(1));
      expect(result.current.conversationId).toBeNull();
      expect(result.current.error).toBeNull();
    },
  );
});
