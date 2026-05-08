/**
 * Accessible tooltip — wraps a single interactive child and exposes the tip
 * text via `role="tooltip"` + `aria-describedby` (plus the WAI-ARIA pattern's
 * required behaviour: show on hover and keyboard focus, dismiss on Escape).
 *
 * The child element is cloned so the tooltip works without an extra wrapper
 * span that would distort layout. Callers must pass exactly one ReactElement
 * that accepts `aria-describedby`, `onMouseEnter`, `onMouseLeave`, `onFocus`,
 * `onBlur`, and `onKeyDown`.
 *
 * Per `web-styling.md` the visual style uses CSS variables only — no
 * hardcoded colours. Per `web-accessibility.md` the tooltip dismisses on
 * Escape per the ARIA Authoring Practices Guide.
 */

import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useId,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react';

import styles from './Tooltip.module.scss';

type Placement = 'top' | 'bottom' | 'left' | 'right';

interface Props {
  content: ReactNode;
  placement?: Placement;
  children: ReactElement;
}

interface ChildEventHandlerProps {
  onMouseEnter?: (event: MouseEvent<HTMLElement>) => void;
  onMouseLeave?: (event: MouseEvent<HTMLElement>) => void;
  onFocus?: (event: FocusEvent<HTMLElement>) => void;
  onBlur?: (event: FocusEvent<HTMLElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
  'aria-describedby'?: string;
}

const PLACEMENT_CLASS: Record<Placement, string> = {
  top: styles.placementTop,
  bottom: styles.placementBottom,
  left: styles.placementLeft,
  right: styles.placementRight,
};

export const Tooltip = ({ content, placement = 'top', children }: Props): ReactElement => {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);

  const child = Children.only(children);
  if (!isValidElement<ChildEventHandlerProps>(child)) {
    throw new Error('Tooltip expects a single ReactElement child.');
  }

  const childProps = child.props;

  const handleShow = useCallback(() => setOpen(true), []);
  const handleHide = useCallback(() => setOpen(false), []);

  const handleMouseEnter = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      childProps.onMouseEnter?.(event);
      handleShow();
    },
    [childProps, handleShow],
  );

  const handleMouseLeave = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      childProps.onMouseLeave?.(event);
      handleHide();
    },
    [childProps, handleHide],
  );

  const handleFocus = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      childProps.onFocus?.(event);
      handleShow();
    },
    [childProps, handleShow],
  );

  const handleBlur = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      childProps.onBlur?.(event);
      handleHide();
    },
    [childProps, handleHide],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      childProps.onKeyDown?.(event);
      if (event.key === 'Escape' && open) {
        event.stopPropagation();
        handleHide();
      }
    },
    [childProps, open, handleHide],
  );

  const enhanced = cloneElement<ChildEventHandlerProps>(child, {
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onFocus: handleFocus,
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
    'aria-describedby': tooltipId,
  });

  return (
    <span className={styles.wrapper}>
      {enhanced}
      <span
        role="tooltip"
        id={tooltipId}
        className={`${styles.tooltip} ${PLACEMENT_CLASS[placement]} ${open ? styles.visible : ''}`}
      >
        {content}
      </span>
    </span>
  );
};
