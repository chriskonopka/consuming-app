/**
 * What belongs here: parse `application/problem+json` (RFC 7807) responses
 * into the typed `ProblemDetails` shape, returning `null` for non-problem
 * responses. Used by useApiClient and direct SSE pre-stream error handling.
 *
 * Scaffolded — implementation lands in slice 2 (used by useApiClient).
 */

import type { ProblemDetails } from '@shared/types';

export const problemDetails = async (response: Response): Promise<ProblemDetails | null> => {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/problem+json')) return null;
  // Slice 2: parse as JSON, validate shape, return.
  return null;
};
