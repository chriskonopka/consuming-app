/**
 * What belongs here: draggable divider between two adjacent panels.
 * Pointer-event drag for mouse / touch, keyboard arrow-key resize,
 * `role="separator"` + `aria-orientation` for screen readers.
 *
 * Scaffolded — implementation lands in slice 3 (used by chat panel) and
 * extended in slice 4 (viewer panel) and slice 5 (responsive polish).
 */

interface Props {
  direction: 'horizontal' | 'vertical';
  widthPx: number;
  minPx: number;
  maxPx: number;
  onResize: (px: number) => void;
  ariaLabel: string;
}

export const Splitter = ({ direction, ariaLabel }: Props) => {
  return <div role="separator" aria-orientation={direction} aria-label={ariaLabel} />;
};
