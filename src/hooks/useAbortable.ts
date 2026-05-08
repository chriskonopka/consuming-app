/**
 * Wraps an async function with an `AbortController` so the in-flight work is
 * cancelled on dependency change, on unmount, or on an explicit `abort()`.
 *
 * Designed for chat's SSE streaming: the consumer calls `run()` from a click
 * handler, the abortable signal is forwarded to `useSseChat`'s fetch, and the
 * controller resets between runs so each send is isolated.
 *
 * Status transitions:
 *   idle → pending (on run)
 *   pending → success (asyncFn resolved)
 *   pending → error (asyncFn threw — and the throw was NOT an abort)
 *   pending → idle (on abort — no error surfaced because the user cancelled)
 */

import { useCallback, useEffect, useRef, useState } from 'react';

type Status = 'idle' | 'pending' | 'success' | 'error';

interface UseAbortableReturn<T> {
  run: () => void;
  abort: () => void;
  status: Status;
  data: T | null;
  error: Error | null;
}

const isAbortError = (err: unknown): boolean =>
  err instanceof DOMException && err.name === 'AbortError';

export const useAbortable = <T>(
  asyncFn: (signal: AbortSignal) => Promise<T>,
  deps: ReadonlyArray<unknown>,
): UseAbortableReturn<T> => {
  const [status, setStatus] = useState<Status>('idle');
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const controllerRef = useRef<AbortController | null>(null);
  const fnRef = useRef(asyncFn);
  // Keep the latest asyncFn without retriggering effects — `deps` is the
  // explicit invalidation surface.
  fnRef.current = asyncFn;

  const abort = useCallback(() => {
    if (!controllerRef.current) return;
    controllerRef.current.abort();
    controllerRef.current = null;
    setStatus((prev) => (prev === 'pending' ? 'idle' : prev));
  }, []);

  const run = useCallback(() => {
    abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus('pending');
    setData(null);
    setError(null);
    fnRef
      .current(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setStatus('success');
        setData(result);
      })
      .catch((err: unknown) => {
        if (isAbortError(err) || controller.signal.aborted) {
          setStatus('idle');
          return;
        }
        setStatus('error');
        setError(err instanceof Error ? err : new Error(String(err)));
      });
  }, [abort]);

  // Cancel on unmount or when the explicit invalidation deps change.
  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps is the explicit invalidation surface for this hook
  }, deps);

  return { run, abort, status, data, error };
};
