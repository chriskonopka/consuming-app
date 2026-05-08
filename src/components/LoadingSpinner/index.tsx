/**
 * Branded spinner. `aria-live="polite"` + `aria-label` so screen readers
 * announce the loading state. Visual is a CSS-only ring; honors
 * `prefers-reduced-motion` (no spin animation when reduced).
 */

import styles from './LoadingSpinner.module.scss';

type Size = 'small' | 'medium' | 'large';

interface Props {
  ariaLabel: string;
  size?: Size;
}

const SIZE_CLASS: Record<Size, string> = {
  small: styles.sizeSmall,
  medium: styles.sizeMedium,
  large: styles.sizeLarge,
};

export const LoadingSpinner = ({ ariaLabel, size = 'medium' }: Props) => {
  return (
    <div role="status" aria-live="polite" aria-label={ariaLabel} className={styles.wrapper}>
      <span aria-hidden="true" className={`${styles.ring} ${SIZE_CLASS[size]}`} />
      <span className={styles.srOnly}>{ariaLabel}</span>
    </div>
  );
};
