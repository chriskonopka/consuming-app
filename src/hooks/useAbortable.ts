/**
 * What belongs here: wraps an async function with an AbortController; aborts
 * on dep change or unmount. Used by chat's SSE streaming.
 *
 * Scaffolded — implementation lands in slice 3.
 */

interface UseAbortableReturn<T> {
  run: () => void;
  abort: () => void;
  status: 'idle' | 'pending' | 'success' | 'error';
  data: T | null;
  error: Error | null;
}

export const useAbortable = <T>(
  _asyncFn: (signal: AbortSignal) => Promise<T>,
  _deps: ReadonlyArray<unknown>,
): UseAbortableReturn<T> => {
  return {
    run: () => {
      // slice 3
    },
    abort: () => {
      // slice 3
    },
    status: 'idle',
    data: null,
    error: null,
  };
};
