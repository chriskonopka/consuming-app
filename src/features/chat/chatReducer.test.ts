import type { CitationData } from '@shared/types';

import { buildInitialChatSession, chatReducer } from './chatReducer';

const initial = (id = 'doc-set-1') => buildInitialChatSession(id);

const citation: CitationData = {
  marker: 1,
  page: 4,
  x: 10,
  y: 20,
  w: 100,
  h: 30,
  fileName: 'master.pdf',
};

describe('chatReducer', () => {
  it('seeds initial state', () => {
    expect(initial()).toEqual({
      documentSetId: 'doc-set-1',
      conversationId: null,
      streaming: null,
      composerText: '',
    });
  });

  it('SET_DOCUMENT_SET resets state and aborts in-flight stream', () => {
    const controller = new AbortController();
    const abortSpy = jest.spyOn(controller, 'abort');
    const withStream = {
      ...initial(),
      streaming: {
        userMessageId: 'u-1',
        assistantBuffer: 'partial',
        citations: [],
        abortController: controller,
        phase: 'thinking' as const,
        phaseStartedAt: 0,
      },
    };
    const next = chatReducer(withStream, { type: 'SET_DOCUMENT_SET', documentSetId: 'doc-set-2' });
    expect(abortSpy).toHaveBeenCalledTimes(1);
    expect(next.documentSetId).toBe('doc-set-2');
    expect(next.streaming).toBeNull();
  });

  it('SET_DOCUMENT_SET no-ops when id matches', () => {
    const state = initial();
    expect(chatReducer(state, { type: 'SET_DOCUMENT_SET', documentSetId: 'doc-set-1' })).toBe(state);
  });

  it('CONVERSATION_RESOLVED stores id', () => {
    expect(
      chatReducer(initial(), { type: 'CONVERSATION_RESOLVED', conversationId: 'c-1' }).conversationId,
    ).toBe('c-1');
  });

  it('CONVERSATION_RESOLVED no-ops when id matches', () => {
    const state = { ...initial(), conversationId: 'c-1' };
    expect(chatReducer(state, { type: 'CONVERSATION_RESOLVED', conversationId: 'c-1' })).toBe(state);
  });

  it('COMPOSER_CHANGED updates text', () => {
    expect(
      chatReducer(initial(), { type: 'COMPOSER_CHANGED', text: 'hello' }).composerText,
    ).toBe('hello');
  });

  it('STREAM_STARTED clears composer and seeds streaming state', () => {
    const controller = new AbortController();
    const next = chatReducer(
      { ...initial(), composerText: 'q', conversationId: 'c-1' },
      {
        type: 'STREAM_STARTED',
        userMessageId: 'u-1',
        conversationId: 'c-1',
        abortController: controller,
        now: 1000,
      },
    );
    expect(next.composerText).toBe('');
    expect(next.streaming?.userMessageId).toBe('u-1');
    expect(next.streaming?.phase).toBe('reading-collection');
    expect(next.streaming?.phaseStartedAt).toBe(1000);
    expect(next.conversationId).toBe('c-1');
  });

  it('STREAM_TOKEN appends to assistantBuffer in arrival order', () => {
    const controller = new AbortController();
    let state = chatReducer(initial(), {
      type: 'STREAM_STARTED',
      userMessageId: 'u',
      conversationId: 'c',
      abortController: controller,
      now: 0,
    });
    state = chatReducer(state, { type: 'STREAM_TOKEN', text: 'Hel' });
    state = chatReducer(state, { type: 'STREAM_TOKEN', text: 'lo ' });
    state = chatReducer(state, { type: 'STREAM_TOKEN', text: 'world' });
    expect(state.streaming?.assistantBuffer).toBe('Hello world');
  });

  it('STREAM_CITATION appends citations', () => {
    const controller = new AbortController();
    let state = chatReducer(initial(), {
      type: 'STREAM_STARTED',
      userMessageId: 'u',
      conversationId: 'c',
      abortController: controller,
      now: 0,
    });
    state = chatReducer(state, { type: 'STREAM_CITATION', citation });
    expect(state.streaming?.citations).toEqual([citation]);
  });

  it('STREAM_PHASE updates phase if changed', () => {
    const controller = new AbortController();
    const started = chatReducer(initial(), {
      type: 'STREAM_STARTED',
      userMessageId: 'u',
      conversationId: 'c',
      abortController: controller,
      now: 0,
    });
    const next = chatReducer(started, {
      type: 'STREAM_PHASE',
      phase: 'thinking',
      now: 2000,
    });
    expect(next.streaming?.phase).toBe('thinking');
    expect(next.streaming?.phaseStartedAt).toBe(2000);
  });

  it('STREAM_PHASE no-ops when same phase', () => {
    const controller = new AbortController();
    const started = chatReducer(initial(), {
      type: 'STREAM_STARTED',
      userMessageId: 'u',
      conversationId: 'c',
      abortController: controller,
      now: 0,
    });
    expect(
      chatReducer(started, { type: 'STREAM_PHASE', phase: 'reading-collection', now: 100 }),
    ).toBe(started);
  });

  it('STREAM_ENDED / STREAM_FAILED / STREAM_ABORTED clear streaming', () => {
    const controller = new AbortController();
    const started = chatReducer(initial(), {
      type: 'STREAM_STARTED',
      userMessageId: 'u',
      conversationId: 'c',
      abortController: controller,
      now: 0,
    });
    expect(chatReducer(started, { type: 'STREAM_ENDED' }).streaming).toBeNull();
    expect(chatReducer(started, { type: 'STREAM_FAILED' }).streaming).toBeNull();
    expect(chatReducer(started, { type: 'STREAM_ABORTED' }).streaming).toBeNull();
  });

  it('CONVERSATION_CLEARED resets state and aborts in-flight stream', () => {
    const controller = new AbortController();
    const abortSpy = jest.spyOn(controller, 'abort');
    const state = chatReducer(initial(), {
      type: 'STREAM_STARTED',
      userMessageId: 'u',
      conversationId: 'c-1',
      abortController: controller,
      now: 0,
    });
    const next = chatReducer({ ...state, conversationId: 'c-1' }, { type: 'CONVERSATION_CLEARED' });
    expect(abortSpy).toHaveBeenCalled();
    expect(next.conversationId).toBeNull();
    expect(next.streaming).toBeNull();
  });

  it('STREAM_TOKEN no-ops when not streaming', () => {
    expect(chatReducer(initial(), { type: 'STREAM_TOKEN', text: 'x' })).toEqual(initial());
  });

  it('STREAM_CITATION no-ops when not streaming', () => {
    expect(chatReducer(initial(), { type: 'STREAM_CITATION', citation })).toEqual(initial());
  });

  it('STREAM_PHASE no-ops when not streaming', () => {
    expect(
      chatReducer(initial(), { type: 'STREAM_PHASE', phase: 'thinking', now: 0 }),
    ).toEqual(initial());
  });
});
