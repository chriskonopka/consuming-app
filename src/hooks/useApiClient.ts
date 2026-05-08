/**
 * Typed `fetch` wrapper. Adds `Authorization: Bearer <token>` via
 * useAccessToken, prepends API_BASE_URL on relative URLs, parses
 * `application/problem+json` into ApiError, captures `X-Operation-Id` for
 * telemetry.
 *
 * Used by features/indexer-host's defense-in-depth check
 * (`GET /document-sets/{id}` confirms the user has access) and reused
 * throughout slices 3-5.
 */

import { useCallback, useMemo } from 'react';

import type { ProblemDetails } from '@shared/types';

import { useAccessToken } from '../auth/useAccessToken';
import { config } from '../config/env';
import { problemDetails } from '../utils/problemDetails';

export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetails | null;
  readonly operationId: string | null;

  constructor(
    message: string,
    status: number,
    problem: ProblemDetails | null,
    operationId: string | null,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.problem = problem;
    this.operationId = operationId;
  }
}

export interface ApiClient {
  get<T>(path: string, init?: RequestInit): Promise<T>;
  post<T>(path: string, body?: unknown, init?: RequestInit): Promise<T>;
  del<T>(path: string): Promise<T>;
  raw(path: string, init?: RequestInit): Promise<Response>;
}

const trimTrailingSlash = (s: string): string => s.replace(/\/+$/, '');

const resolveUrl = (base: string, path: string): string => {
  if (/^https?:\/\//i.test(path)) return path;
  return `${trimTrailingSlash(base)}${path.startsWith('/') ? path : `/${path}`}`;
};

export const useApiClient = (): ApiClient => {
  const getAccessToken = useAccessToken();
  const base = config.apiBaseUrl;

  const exec = useCallback(
    async <T>(
      method: string,
      path: string,
      body: unknown,
      init: RequestInit | undefined,
    ): Promise<T> => {
      const token = await getAccessToken();
      const url = resolveUrl(base, path);
      const headers = new Headers(init?.headers);
      headers.set('Authorization', `Bearer ${token}`);
      headers.set('Accept', 'application/json');
      let resolvedBody: BodyInit | undefined;
      if (body !== undefined && body !== null) {
        if (body instanceof FormData) {
          resolvedBody = body;
        } else {
          headers.set('Content-Type', 'application/json');
          resolvedBody = JSON.stringify(body);
        }
      }

      const response = await fetch(url, {
        ...init,
        method,
        headers,
        body: resolvedBody,
      });

      const operationId = response.headers.get('X-Operation-Id');

      if (!response.ok) {
        const problem = await problemDetails(response);
        throw new ApiError(
          problem?.detail ?? response.statusText,
          response.status,
          problem,
          operationId,
        );
      }

      if (response.status === 204) return undefined as unknown as T;
      const text = await response.text();
      if (!text) return undefined as unknown as T;
      return JSON.parse(text) as T;
    },
    [base, getAccessToken],
  );

  return useMemo<ApiClient>(
    () => ({
      get: (path, init) => exec('GET', path, undefined, init),
      post: (path, body, init) => exec('POST', path, body, init),
      del: (path) => exec('DELETE', path, undefined, undefined),
      raw: async (path, init) => {
        const token = await getAccessToken();
        const headers = new Headers(init?.headers);
        headers.set('Authorization', `Bearer ${token}`);
        return fetch(resolveUrl(base, path), { ...init, headers });
      },
    }),
    [exec, base, getAccessToken],
  );
};
