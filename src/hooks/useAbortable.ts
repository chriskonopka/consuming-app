/**
 * Wraps an async function with an AbortController; aborts on dep change or
 * unmount. Used by chat's SSE streaming so navigation away during a stream
 * cancels cleanly without leaving in-flight fetches.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseAbortableReturn<T> {
  run: () => void;
  abort: () => void;
  status: 'idle' | 'pending' | 'success' | 'error';
  data: T | null;
  error: Error | null;
}

export const useAbortable = <T>(
  asyncFn: (signal: AbortSignal) => Promise<T>,
  deps: ReadonlyArray<unknown>,
): UseAbortableReturn<T> => {
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>(
    'idle',
  );
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const controllerRef = useRef<AbortController | null>(null);
  const asyncFnRef = useRef(asyncFn);
  asyncFnRef.current = asyncFn;

  const abort = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  const run = useCallback(() => {
    abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus('pending');
    setError(null);
    void (async () => {
      try {
        const result = await asyncFnRef.current(controller.signal);
        if (controller.signal.aborted) return;
        setData(result);
        setStatus('success');
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setStatus('error');
      }
    })();
  }, [abort]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => abort(), deps);

  return { run, abort, status, data, error };
};
