import { act, renderHook } from '@testing-library/react';

import type { ChatSession } from '@shared/types';

import { type ChatAction } from './chatReducer';
import { useStatusRow } from './useStatusRow';

const buildStreamingSession = (overrides: Partial<ChatSession['streaming']> = {}): ChatSession => ({
  documentSetId: 'doc',
  conversationId: 'c',
  composerText: '',
  streaming: {
    userMessageId: 'u',
    userMessageText: 'q',
    assistantBuffer: '',
    citations: [],
    abortController: new AbortController(),
    phase: 'reading-collection',
    phaseStartedAt: 0,
    ...overrides,
  },
});

describe('useStatusRow', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(0));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns invisible when no streaming', () => {
    const session: ChatSession = {
      documentSetId: 'doc',
      conversationId: 'c',
      streaming: null,
      composerText: '',
    };
    const { result } = renderHook(() => useStatusRow(session, jest.fn()));
    expect(result.current.visible).toBe(false);
  });

  it('returns the primary phrase for the current phase', () => {
    const dispatch = jest.fn<void, [ChatAction]>();
    const session = buildStreamingSession();
    const { result } = renderHook(() => useStatusRow(session, dispatch));
    expect(result.current.primary).toBe('Reading your collection');
    expect(result.current.fallback).toBeNull();
  });

  it('dispatches phase advancement after timeline thresholds', () => {
    const dispatch = jest.fn<void, [ChatAction]>();
    const session = buildStreamingSession();
    renderHook(() => useStatusRow(session, dispatch));
    act(() => {
      jest.setSystemTime(new Date(2000));
      jest.advanceTimersByTime(2000);
    });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'STREAM_PHASE', phase: 'thinking' }),
    );
  });

  it('switches to finalizing as soon as a token arrives', () => {
    const dispatch = jest.fn<void, [ChatAction]>();
    const sessionStart = buildStreamingSession();
    const { rerender } = renderHook(({ session }) => useStatusRow(session, dispatch), {
      initialProps: { session: sessionStart },
    });
    rerender({ session: buildStreamingSession({ assistantBuffer: 'H' }) });
    act(() => {
      jest.advanceTimersByTime(250);
    });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'STREAM_PHASE', phase: 'finalizing' }),
    );
  });

  it('rotates fallback phrases when phase is stuck', () => {
    const dispatch = jest.fn<void, [ChatAction]>();
    const session = buildStreamingSession({ phase: 'thinking', phaseStartedAt: 0 });
    const { result } = renderHook(() => useStatusRow(session, dispatch));
    act(() => {
      jest.setSystemTime(new Date(1500));
      jest.advanceTimersByTime(1500);
    });
    expect(result.current.fallback).not.toBeNull();
  });
});
