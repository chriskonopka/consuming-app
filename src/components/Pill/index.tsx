/**
 * Status / type badge with text + colour. Color-blind safe — text label
 * always present.
 */

import styles from './Pill.module.css';

interface Props {
  label: string;
  tone: 'neutral' | 'info' | 'success' | 'warning' | 'error';
  ariaLabel?: string;
  truncated?: boolean;
}

export const Pill = ({ label, tone, ariaLabel, truncated }: Props) => {
  return (
    <span
      className={`${styles.pill} ${styles[tone]} ${truncated ? styles.truncated : ''}`}
      aria-label={ariaLabel ?? label}
      title={truncated ? label : undefined}
    >
      {label}
    </span>
  );
};
