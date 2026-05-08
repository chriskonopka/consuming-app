/**
 * Client-side constants for the chat status row simulator (REQUIREMENTS.md §4.5).
 *
 * The API's SSE stream emits only `token` / `citation` / `error` events — no
 * progress signal. The status row is purely client-side: a deterministic
 * timeline + reassuring sub-phrases when wall time drifts past a phase's
 * primary message without a token arriving.
 *
 * If the API ever emits explicit status events, this file is the only place
 * that needs to change.
 */

import type { SimulatedPhase } from '@shared/types';

/** Phase begins after this many ms of no tokens since the previous phase. */
export const PHASE_TIMELINE_MS: Record<SimulatedPhase, number> = {
  'reading-collection': 0,
  'picking-documents': 500,
  'reading-files': 1200,
  thinking: 2000,
  // 'finalizing' is triggered by the first token, not wall time.
  finalizing: Number.POSITIVE_INFINITY,
};

/** Display order for the pre-token phases. `finalizing` is event-driven. */
export const PHASE_ORDER: SimulatedPhase[] = [
  'reading-collection',
  'picking-documents',
  'reading-files',
  'thinking',
  'finalizing',
];

export const PRIMARY_PHASE_LABEL: Record<SimulatedPhase, string> = {
  'reading-collection': 'Reading your collection',
  'picking-documents': 'Picking documents',
  'reading-files': 'Reading selected files',
  thinking: 'Thinking…',
  finalizing: 'Finalizing response',
};

/**
 * Reassuring sub-phrases shown when a phase has been stuck without progress
 * for {@link FALLBACK_AFTER_MS}; rotates every {@link FALLBACK_ROTATE_MS}.
 */
export const FALLBACK_PHRASES: Record<SimulatedPhase, ReadonlyArray<string>> = {
  'reading-collection': ['Indexing your sources', 'Looking at folders'],
  'picking-documents': ['Choosing relevant files', 'Narrowing down'],
  'reading-files': ['Skimming passages', 'Cross-referencing'],
  thinking: ['Working through the question', 'Putting an answer together'],
  finalizing: ['Polishing the answer'],
};

/** ms of stillness within a phase before fallback phrases start showing. */
export const FALLBACK_AFTER_MS = 1500;

/** ms between fallback phrase rotations within a phase. */
export const FALLBACK_ROTATE_MS = 2500;
