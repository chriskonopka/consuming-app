/**
 * Drives the status-row simulator. Pure timing logic — given a `streaming`
 * snapshot, returns the label to render (primary phrase, optionally rotated
 * to a fallback if the phase has been stuck without progress).
 *
 * See REQUIREMENTS.md §4.5 for the timing constants. The state shape lives in
 * the reducer; this hook wires the wall-clock interval so the reducer stays
 * pure.
 *
 * The interval is cleared on streaming end, on dependency change, and on
 * unmount — `web-component-architecture.md` "useEffect & Cleanup".
 */

import { useEffect, useRef, useState, type Dispatch } from 'react';

import type { ChatSession, SimulatedPhase } from '@shared/types';

import { type ChatAction } from './chatReducer';
import {
  FALLBACK_AFTER_MS,
  FALLBACK_PHRASES,
  FALLBACK_ROTATE_MS,
  PHASE_ORDER,
  PHASE_TIMELINE_MS,
  PRIMARY_PHASE_LABEL,
} from './statusPhrases';

const TICK_MS = 250;

const nextPhaseFor = (
  current: SimulatedPhase,
  streamStartedAt: number,
  hasFirstToken: boolean,
  now: number,
): SimulatedPhase => {
  if (hasFirstToken) return 'finalizing';
  const elapsed = now - streamStartedAt;
  let phase: SimulatedPhase = current;
  for (const candidate of PHASE_ORDER) {
    if (candidate === 'finalizing') continue;
    if (elapsed >= PHASE_TIMELINE_MS[candidate]) {
      phase = candidate;
    }
  }
  return phase;
};

const fallbackPhraseFor = (phase: SimulatedPhase, phaseStartedAt: number, now: number): string | null => {
  const elapsedInPhase = now - phaseStartedAt;
  if (elapsedInPhase < FALLBACK_AFTER_MS) return null;
  const phrases = FALLBACK_PHRASES[phase];
  if (phrases.length === 0) return null;
  const rotation = Math.floor((elapsedInPhase - FALLBACK_AFTER_MS) / FALLBACK_ROTATE_MS);
  return phrases[rotation % phrases.length];
};

export interface StatusRowState {
  visible: boolean;
  primary: string;
  fallback: string | null;
}

export const useStatusRow = (
  session: ChatSession | null,
  dispatch: Dispatch<ChatAction> | null,
): StatusRowState => {
  const [now, setNow] = useState(() => Date.now());
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  const streaming = session?.streaming ?? null;
  const hasFirstToken = streaming ? streaming.assistantBuffer.length > 0 : false;

  useEffect(() => {
    if (!streaming) return undefined;
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, TICK_MS);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [streaming]);

  // Phase advancement — derived from now, dispatched only when it changes.
  useEffect(() => {
    if (!streaming || !dispatchRef.current) return;
    const phase = nextPhaseFor(
      streaming.phase,
      streaming.phaseStartedAt,
      hasFirstToken,
      now,
    );
    if (phase !== streaming.phase) {
      dispatchRef.current({ type: 'STREAM_PHASE', phase, now });
    }
  }, [streaming, hasFirstToken, now]);

  if (!streaming) {
    return { visible: false, primary: '', fallback: null };
  }

  return {
    visible: true,
    primary: PRIMARY_PHASE_LABEL[streaming.phase],
    fallback: fallbackPhraseFor(streaming.phase, streaming.phaseStartedAt, now),
  };
};
