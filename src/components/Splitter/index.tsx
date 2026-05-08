/**
 * Draggable divider between two adjacent panels.
 *
 * - Pointer-event drag for mouse / touch (works through pointer abstractions).
 * - Keyboard arrow-key resize (10px steps; Home/End jump to min/max).
 * - `role="separator"`, `aria-orientation`, `aria-valuenow`/`min`/`max` so
 *   assistive tech announces the current width.
 * - Width clamped to `[minPx, maxPx]` regardless of input source.
 *
 * The `direction` prop describes the splitter's *orientation* axis the
 * separator runs along — `horizontal` = a vertical grip resizing left/right,
 * `vertical` = a horizontal grip resizing top/bottom. We use `horizontal` for
 * both chat and viewer panels in v1 (resizing width).
 */

import { useCallback, useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';

import styles from './Splitter.module.scss';

interface Props {
  direction: 'horizontal' | 'vertical';
  /** Resize anchor side — controls drag-direction sign. `left` and `right` for horizontal panels. */
  resizeFrom?: 'left' | 'right';
  widthPx: number;
  minPx: number;
  maxPx: number;
  onResize: (px: number) => void;
  ariaLabel: string;
}

const KEYBOARD_STEP_PX = 10;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const Splitter = ({
  direction,
  resizeFrom = 'left',
  widthPx,
  minPx,
  maxPx,
  onResize,
  ariaLabel,
}: Props) => {
  const startRef = useRef<{ pointerId: number; startX: number; startY: number; startWidth: number } | null>(null);
  const widthRef = useRef(widthPx);
  widthRef.current = widthPx;

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 && event.pointerType !== 'touch') return;
      const target = event.currentTarget;
      target.setPointerCapture(event.pointerId);
      startRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startWidth: widthRef.current,
      };
    },
    [],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const start = startRef.current;
      if (!start || start.pointerId !== event.pointerId) return;
      const delta =
        direction === 'horizontal' ? event.clientX - start.startX : event.clientY - start.startY;
      const sign = resizeFrom === 'left' ? 1 : -1;
      const next = clamp(start.startWidth + sign * delta, minPx, maxPx);
      onResize(next);
    },
    [direction, resizeFrom, minPx, maxPx, onResize],
  );

  const handlePointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const target = event.currentTarget;
      if (target.hasPointerCapture(event.pointerId)) {
        target.releasePointerCapture(event.pointerId);
      }
      startRef.current = null;
    },
    [],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      let next: number | null = null;
      const sign = resizeFrom === 'left' ? 1 : -1;
      if (event.key === 'ArrowLeft') next = widthRef.current - sign * KEYBOARD_STEP_PX;
      else if (event.key === 'ArrowRight') next = widthRef.current + sign * KEYBOARD_STEP_PX;
      else if (event.key === 'ArrowUp') next = widthRef.current + sign * KEYBOARD_STEP_PX;
      else if (event.key === 'ArrowDown') next = widthRef.current - sign * KEYBOARD_STEP_PX;
      else if (event.key === 'Home') next = minPx;
      else if (event.key === 'End') next = maxPx;
      if (next === null) return;
      event.preventDefault();
      onResize(clamp(next, minPx, maxPx));
    },
    [resizeFrom, minPx, maxPx, onResize],
  );

  useEffect(() => {
    return () => {
      startRef.current = null;
    };
  }, []);

  return (
    /* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex -- ARIA window-splitter is operable; separator role + tabIndex required */
    <div
      role="separator"
      aria-orientation={direction === 'horizontal' ? 'vertical' : 'horizontal'}
      aria-label={ariaLabel}
      aria-valuenow={widthPx}
      aria-valuemin={minPx}
      aria-valuemax={maxPx}
      tabIndex={0}
      className={`${styles.splitter} ${direction === 'horizontal' ? styles.horizontal : styles.vertical}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
    />
    /* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
  );
};
