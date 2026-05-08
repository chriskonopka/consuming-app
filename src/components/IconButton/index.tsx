/**
 * Phosphor icon wrapper with consistent sizing + a11y label. `aria-label` is
 * mandatory. Tone selects from the design-token palette (no raw colours).
 */

import type { ComponentType, MouseEventHandler } from 'react';

import styles from './IconButton.module.scss';

type Tone = 'default' | 'primary' | 'danger';

interface Props {
  icon: ComponentType<{ size?: number; weight?: 'regular' | 'bold' }>;
  ariaLabel: string;
  onClick: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  tone?: Tone;
  type?: 'button' | 'submit';
  ariaPressed?: boolean;
  ariaExpanded?: boolean;
  ariaControls?: string;
}

const TONE_CLASS: Record<Tone, string> = {
  default: styles.toneDefault,
  primary: styles.tonePrimary,
  danger: styles.toneDanger,
};

export const IconButton = ({
  icon: Icon,
  ariaLabel,
  onClick,
  disabled,
  tone = 'default',
  type = 'button',
  ariaPressed,
  ariaExpanded,
  ariaControls,
}: Props) => {
  return (
    <button
      type={type}
      className={`${styles.button} ${TONE_CLASS[tone]}`}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon size={20} weight="regular" />
    </button>
  );
};
