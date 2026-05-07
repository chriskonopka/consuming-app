/**
 * What belongs here: Phosphor icon wrapper with consistent sizing + a11y
 * label. `aria-label` is mandatory.
 *
 * Scaffolded — implementation lands in slice 3.
 */

import type { ComponentType } from 'react';

interface Props {
  icon: ComponentType<{ size?: number; weight?: 'regular' | 'bold' }>;
  ariaLabel: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'default' | 'primary' | 'danger';
}

export const IconButton = ({ icon: Icon, ariaLabel, onClick, disabled }: Props) => {
  return (
    <button type="button" aria-label={ariaLabel} onClick={onClick} disabled={disabled}>
      <Icon size={24} weight="regular" />
    </button>
  );
};
