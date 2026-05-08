jest.mock('../auth/msalInstance');
jest.mock('../config/env', () => ({
  config: {
    apiBaseUrl: 'https://api.test',
    indexerRemoteUrl: 'http://localhost:9998',
    msalClientId: 'cid',
    msalAuthority: 'auth',
    msalApiScope: 'scope',
    appInsightsConnectionString: '',
  },
}));

import { act, renderHook, waitFor } from '@testing-library/react';
import { useState, type ReactNode } from 'react';

import { MsalAppProvider } from '../auth/MsalAppProvider';
import { ApiError, useApiClient } from './useApiClient';

import { useAuth } from '../auth/useAuth';

const wrapper = ({ children }: { children: ReactNode }) => (
  <MsalAppProvider>{children}</MsalAppProvider>
);

const useApiClientWithAuth = () => {
  // Bind a stable `useAuth` consumer to the same provider so the test can
  // assert that 401-twice triggers expireAuth().
  const auth = useAuth();
  const [statusSnapshot, setStatusSnapshot] = useState(auth.state.status);
  if (auth.state.status !== statusSnapshot) {
    setStatusSnapshot(auth.state.status);
  }
  return { client: useApiClient(), authStatus: auth.state.status };
};

const msalMock = jest.requireMock('../auth/msalInstance');

describe('useApiClient', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    msalMock.__resetMsalMock();
    // useAccessToken throws `no_active_account` unless one is set on the
    // singleton — seed a fake account so token acquisition resolves.
    msalMock.msalInstance.getActiveAccount.mockReturnValue({
      homeAccountId: 'h-1',
      username: 'test@example.com',
      name: 'Test',
    });
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('prepends API_BASE_URL to relative paths and attaches Authorization', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const { result } = renderHook(() => useApiClient(), { wrapper });

    const data = await result.current.get<{ ok: boolean }>('/document-sets/abc');
    expect(data).toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.test/document-sets/abc');
    const headers = (init as RequestInit).headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer mock-silent-token');
    expect(headers.get('Accept')).toContain('application/json');
  });

  it('does not prepend API_BASE_URL to absolute URLs', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const { result } = renderHook(() => useApiClient(), { wrapper });
    await result.current.get('https://other.example/x');

    expect(fetchMock.mock.calls[0][0]).toBe('https://other.example/x');
  });

  it('serializes JSON body and adds Content-Type header on POST', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'c-1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const { result } = renderHook(() => useApiClient(), { wrapper });
    await result.current.post('/conversations', { content: 'hi' });

    const [, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).body).toBe('{"content":"hi"}');
    const headers = (init as RequestInit).headers as Headers;
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('throws ApiError with parsed problem details on 4xx', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          type: 'https://problems.api/validation-failed',
          title: 'Validation failed',
          status: 400,
          detail: 'content too long',
        }),
        {
          status: 400,
          headers: {
            'content-type': 'application/problem+json',
            'X-Operation-Id': 'op-1',
          },
        },
      ),
    );

    const { result } = renderHook(() => useApiClient(), { wrapper });
    await expect(result.current.get('/x')).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      operationId: 'op-1',
      problem: { type: 'https://problems.api/validation-failed', detail: 'content too long' },
    });
  });

  it('retries once on 401 then succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response('', { status: 401, headers: { 'X-Operation-Id': 'op-401' } }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

    const { result } = renderHook(() => useApiClient(), { wrapper });
    await expect(result.current.get('/x')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('on second 401 calls expireAuth and throws ApiError', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(new Response('', { status: 401 }));

    const { result, rerender } = renderHook(() => useApiClientWithAuth(), { wrapper });

    await expect(result.current.client.get('/x')).rejects.toBeInstanceOf(ApiError);

    rerender();
    await waitFor(() => {
      expect(result.current.authStatus).toBe('expired');
    });
  });

  it('returns the raw Response from .raw() without throwing on non-2xx', async () => {
    fetchMock.mockResolvedValueOnce(new Response('body', { status: 404 }));

    const { result } = renderHook(() => useApiClient(), { wrapper });
    const response = await result.current.raw('/x');
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('body');
  });

  it('handles 204 No Content as undefined (DELETE)', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const { result } = renderHook(() => useApiClient(), { wrapper });
    const data = await result.current.del<undefined>('/x');
    expect(data).toBeUndefined();
  });

  it('passes through caller-supplied init options (signal, custom headers)', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const controller = new AbortController();

    const { result } = renderHook(() => useApiClient(), { wrapper });
    await act(async () => {
      await result.current.get('/x', {
        signal: controller.signal,
        headers: { 'X-Custom': 'v' },
      });
    });
    const [, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).signal).toBe(controller.signal);
    expect(((init as RequestInit).headers as Headers).get('X-Custom')).toBe('v');
  });
});
