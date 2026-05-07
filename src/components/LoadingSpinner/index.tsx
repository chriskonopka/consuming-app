/**
 * What belongs here: branded spinner with `aria-live="polite"` for screen
 * readers. Used by Suspense fallbacks and per-feature loading states.
 *
 * Scaffolded — implementation lands in slice 3.
 */

interface Props {
  ariaLabel: string;
  size?: 'small' | 'medium' | 'large';
}

export const LoadingSpinner = ({ ariaLabel }: Props) => {
  return (
    <div role="status" aria-live="polite" aria-label={ariaLabel}>
      Loading…
    </div>
  );
};
