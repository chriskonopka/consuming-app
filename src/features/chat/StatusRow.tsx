/**
 * Renders the streaming status row (REQUIREMENTS.md §4.5). The container is a
 * polite live region so screen readers announce phase changes without
 * interrupting the streamed answer. The visual spinner is decorative —
 * `aria-hidden` so it doesn't double up the announcement.
 */

import type { StatusRowState } from './useStatusRow';

import styles from './StatusRow.module.scss';

interface Props {
  state: StatusRowState;
}

export const StatusRow = ({ state }: Props) => {
  if (!state.visible) return null;
  const label = state.fallback ?? state.primary;
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className={styles.row}>
      <span aria-hidden="true" className={styles.dot} />
      <span className={styles.label}>{label}</span>
    </div>
  );
};
