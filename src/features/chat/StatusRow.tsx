/**
 * Above-the-stream status indicator. Simplified vs REQUIREMENTS §4.5 —
 * shows "Reading collection…" → "Picking documents…" → "Thinking…" until
 * the first token arrives, then hides. The full fallback-cycle elaboration
 * is deferred.
 */

import { useEffect, useState } from 'react';

import { LoadingSpinner } from '../../components/LoadingSpinner';
import styles from './StatusRow.module.css';

const PHASES = [
  { delayMs: 0, label: 'Reading your collection' },
  { delayMs: 500, label: 'Picking documents' },
  { delayMs: 1200, label: 'Reading selected files' },
  { delayMs: 2000, label: 'Thinking…' },
] as const;

interface Props {
  /** True while a stream is in flight AND no tokens have arrived yet. */
  active: boolean;
}

export const StatusRow = ({ active }: Props) => {
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setPhaseIndex(0);
      return;
    }
    setPhaseIndex(0);
    const startedAt = performance.now();
    const interval = setInterval(() => {
      const elapsed = performance.now() - startedAt;
      let next = 0;
      for (let i = 0; i < PHASES.length; i++) {
        if (elapsed >= PHASES[i].delayMs) next = i;
      }
      setPhaseIndex(next);
    }, 250);
    return () => clearInterval(interval);
  }, [active]);

  if (!active) return null;

  return (
    <div className={styles.row} role="status" aria-live="polite">
      <LoadingSpinner ariaLabel="Working" size="small" />
      <span className={styles.label}>{PHASES[phaseIndex].label}</span>
    </div>
  );
};
