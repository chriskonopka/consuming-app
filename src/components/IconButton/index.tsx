/**
 * Phosphor icon wrapper with consistent sizing + a11y label.
 * `aria-label` is mandatory.
 */

import type { ComponentType } from 'react';

import styles from './IconButton.module.css';

interface Props {
  icon: ComponentType<{ size?: number; weight?: 'regular' | 'bold' }>;
  ariaLabel: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'default' | 'primary' | 'danger';
}

export const IconButton = ({
  icon: Icon,
  ariaLabel,
  onClick,
  disabled,
  tone = 'default',
}: Props) => {
  return (
    <button
      type="button"
      className={`${styles.button} ${styles[tone]}`}
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon size={20} weight="regular" />
    </button>
  );
};
