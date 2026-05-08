/**
 * Typed `fetch` wrapper used by every feature that hits the GlobalIndexer API
 * (per shared-inventory.md). Behaviour locked to:
 *   - prepends `API_BASE_URL` when the URL is relative
 *   - adds `Authorization: Bearer <token>` from `useAccessToken()`
 *   - parses `application/problem+json` into a typed `ApiError`
 *   - captures `X-Operation-Id` and logs to App Insights via `trackDependency`
 *   - retries once on 401 after MSAL silent refresh; on second 401 calls
 *     `useAuth().expireAuth()` so the AuthGate flips to the sign-in screen.
 *
 * Same `getAccessToken` reference handed to the indexer is used here, so the
 * audience is uniform (CLAUDE.md §"Token uniformity").
 */

import { useCallback } from 'react';

import type { GetAccessToken, ProblemDetails } from '@shared/types';

import { useAuth } from '../auth/useAuth';
import { useAccessToken } from '../auth/useAccessToken';
import { appInsights } from '../appInsights';
import { config } from '../config/env';
import { problemDetails } from '../utils/problemDetails';

const OPERATION_ID_HEADER = 'X-Operation-Id';

export interface ApiClient {
  get: <T>(url: string, init?: RequestInit) => Promise<T>;
  post: <T>(url: string, body?: unknown, init?: RequestInit) => Promise<T>;
  del: <T>(url: string) => Promise<T>;
  raw: (url: string, init?: RequestInit) => Promise<Response>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetails | null;
  readonly operationId: string | null;
  constructor(status: number, problem: ProblemDetails | null, operationId: string | null) {
    super(problem?.detail ?? problem?.title ?? `API error ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.problem = problem;
    this.operationId = operationId;
  }
}

const isAbsoluteUrl = (url: string): boolean => /^[a-z][a-z\d+\-.]*:\/\//i.test(url);

const resolveUrl = (url: string): string =>
  isAbsoluteUrl(url) ? url : `${config.apiBaseUrl}${url}`;

const buildHeaders = (
  token: string,
  init: RequestInit | undefined,
  hasJsonBody: boolean,
): Headers => {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (hasJsonBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json, application/problem+json');
  }
  return headers;
};

const trackDependency = (url: string, response: Response, operationId: string | null): void => {
  if (!appInsights) return;
  // Best-effort: any telemetry failure must not propagate into the call site.
  try {
    appInsights.trackDependencyData({
      id: operationId ?? '',
      name: `${response.status} ${url}`,
      target: new URL(resolveUrl(url), 'http://_').host,
      duration: 0,
      success: response.ok,
      responseCode: response.status,
      properties: operationId ? { operationId } : undefined,
    });
  } catch {
    // swallow — telemetry is observational, never load-bearing
  }
};

const performRequest = async (
  getAccessToken: GetAccessToken,
  url: string,
  init: RequestInit,
  hasJsonBody: boolean,
): Promise<Response> => {
  const token = await getAccessToken();
  const headers = buildHeaders(token, init, hasJsonBody);
  return fetch(resolveUrl(url), { ...init, headers });
};

const parseJsonOrEmpty = async <T>(response: Response): Promise<T> => {
  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return undefined as T;
  return (await response.json()) as T;
};

const toApiError = async (response: Response): Promise<ApiError> => {
  const problem = await problemDetails(response);
  const operationId = response.headers.get(OPERATION_ID_HEADER);
  return new ApiError(response.status, problem, operationId);
};

export const useApiClient = (): ApiClient => {
  const getAccessToken = useAccessToken();
  const { expireAuth } = useAuth();

  const raw = useCallback(
    async (url: string, init: RequestInit = {}): Promise<Response> => {
      const hasJsonBody = init.body !== undefined && typeof init.body === 'string';
      let response = await performRequest(getAccessToken, url, init, hasJsonBody);
      if (response.status === 401) {
        // One retry: useAccessToken's silent-acquire path will trigger MSAL
        // refresh; if that also returns 401, treat the session as expired.
        response = await performRequest(getAccessToken, url, init, hasJsonBody);
        if (response.status === 401) {
          expireAuth();
          throw await toApiError(response);
        }
      }
      const operationId = response.headers.get(OPERATION_ID_HEADER);
      trackDependency(url, response, operationId);
      return response;
    },
    [getAccessToken, expireAuth],
  );

  const requestJson = useCallback(
    async <T>(url: string, init: RequestInit): Promise<T> => {
      const response = await raw(url, init);
      if (!response.ok) {
        throw await toApiError(response);
      }
      return parseJsonOrEmpty<T>(response);
    },
    [raw],
  );

  const get = useCallback(
    <T>(url: string, init?: RequestInit) => requestJson<T>(url, { ...init, method: 'GET' }),
    [requestJson],
  );

  const post = useCallback(
    <T>(url: string, body?: unknown, init?: RequestInit) =>
      requestJson<T>(url, {
        ...init,
        method: 'POST',
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    [requestJson],
  );

  const del = useCallback(
    <T>(url: string) => requestJson<T>(url, { method: 'DELETE' }),
    [requestJson],
  );

  return { get, post, del, raw };
};
