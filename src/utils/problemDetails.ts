/**
 * Parse `application/problem+json` (RFC 7807) responses into the typed
 * `ProblemDetails` shape, returning `null` for non-problem responses.
 */

import type { ProblemDetails } from '@shared/types';

export const problemDetails = async (
  response: Response,
): Promise<ProblemDetails | null> => {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/problem+json')) return null;
  try {
    const body = (await response.json()) as Partial<ProblemDetails>;
    if (!body || typeof body !== 'object') return null;
    return {
      type: body.type ?? 'about:blank',
      title: body.title ?? response.statusText,
      status: body.status ?? response.status,
      detail: body.detail ?? response.statusText,
      errors: body.errors,
    };
  } catch {
    return null;
  }
};
