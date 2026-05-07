/**
 * What belongs here: status / type badge with text + colour. Color-blind
 * safe (text label always present).
 *
 * Scaffolded — implementation lands in slice 3.
 */

interface Props {
  label: string;
  tone: 'neutral' | 'info' | 'success' | 'warning' | 'error';
  ariaLabel?: string;
  truncated?: boolean;
}

export const Pill = ({ label, ariaLabel }: Props) => {
  return <span aria-label={ariaLabel ?? label}>{label}</span>;
};
