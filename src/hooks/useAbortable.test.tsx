import { act, renderHook, waitFor } from '@testing-library/react';

import { useAbortable } from './useAbortable';

describe('useAbortable', () => {
  it('starts in idle status', () => {
    const { result } = renderHook(() => useAbortable(async () => 'ok', []));
    expect(result.current.status).toBe('idle');
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('moves to pending then success', async () => {
    const { result } = renderHook(() =>
      useAbortable(async () => 'ok', []),
    );
    act(() => {
      result.current.run();
    });
    expect(result.current.status).toBe('pending');
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.data).toBe('ok');
  });

  it('captures Errors from the async fn into error state', async () => {
    const boom = new Error('boom');
    const { result } = renderHook(() =>
      useAbortable<string>(async () => {
        throw boom;
      }, []),
    );
    act(() => {
      result.current.run();
    });
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe(boom);
  });

  it('returns to idle when aborted', async () => {
    let resolveFn: (value: string) => void = () => undefined;
    const { result } = renderHook(() =>
      useAbortable<string>(
        () =>
          new Promise<string>((resolve) => {
            resolveFn = resolve;
          }),
        [],
      ),
    );
    act(() => {
      result.current.run();
    });
    expect(result.current.status).toBe('pending');
    act(() => {
      result.current.abort();
    });
    act(() => {
      resolveFn('late');
    });
    await waitFor(() => expect(result.current.status).toBe('idle'));
  });

  it('treats DOMException AbortError as an abort, not an error', async () => {
    const { result } = renderHook(() =>
      useAbortable<string>(async (signal) => {
        await new Promise<void>((resolve) => {
          signal.addEventListener('abort', () => resolve(), { once: true });
        });
        throw new DOMException('aborted', 'AbortError');
      }, []),
    );
    act(() => {
      result.current.run();
    });
    act(() => {
      result.current.abort();
    });
    await waitFor(() => expect(result.current.status).toBe('idle'));
    expect(result.current.error).toBeNull();
  });
});
