/**
 * Branded spinner with `aria-live="polite"` for screen readers. Used by
 * Suspense fallbacks and per-feature loading states.
 */

import styles from './LoadingSpinner.module.css';

interface Props {
  ariaLabel: string;
  size?: 'small' | 'medium' | 'large';
}

export const LoadingSpinner = ({ ariaLabel, size = 'medium' }: Props) => {
  return (
    <div role="status" aria-live="polite" aria-label={ariaLabel} className={styles.wrap}>
      <span className={`${styles.spinner} ${styles[size]}`} aria-hidden="true" />
    </div>
  );
};
