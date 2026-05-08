/**
 * Parses RFC 7807 ProblemDetails responses (`application/problem+json`).
 *
 * Returns the parsed object on a content-type match, `null` otherwise. Used
 * by `useApiClient` to surface typed API errors and by SSE pre-stream error
 * handling (slice 3) where the response is a single problem JSON before the
 * stream begins.
 */

import type { ProblemDetails } from '@shared/types';

const isProblemDetails = (value: unknown): value is ProblemDetails => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<ProblemDetails>;
  return (
    typeof candidate.type === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.status === 'number' &&
    typeof candidate.detail === 'string'
  );
};

export const problemDetails = async (
  response: Response,
): Promise<ProblemDetails | null> => {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/problem+json')) return null;
  try {
    const parsed: unknown = await response.clone().json();
    return isProblemDetails(parsed) ? parsed : null;
  } catch {
    return null;
  }
};
