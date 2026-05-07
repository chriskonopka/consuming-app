/**
 * What belongs here: typed `fetch` wrapper. Adds `Authorization: Bearer <token>`
 * via useAccessToken, prepends API_BASE_URL on relative URLs, parses
 * `application/problem+json` into typed ApiError, captures `X-Operation-Id`
 * for telemetry, retries once on 401 after MSAL silent refresh.
 *
 * Scaffolded — implementation lands in slice 2 (used by indexer-host's
 * defense-in-depth check) and reused throughout slices 3–5.
 */

interface ApiClient {
  get<T>(url: string, init?: RequestInit): Promise<T>;
  post<T>(url: string, body?: unknown, init?: RequestInit): Promise<T>;
  del<T>(url: string): Promise<T>;
  raw(url: string, init?: RequestInit): Promise<Response>;
}

export const useApiClient = (): ApiClient => {
  const notImplemented = (): never => {
    throw new Error('useApiClient: not implemented in scaffold — landed in slice 2.');
  };
  return {
    get: notImplemented,
    post: notImplemented,
    del: notImplemented,
    raw: notImplemented,
  };
};
