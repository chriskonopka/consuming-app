/**
 * Status / type badge — text + colour, with the text label always present so
 * the meaning isn't colour-only (per `web-accessibility.md`). Tone selects
 * from the design-token palette; no raw colours.
 *
 * The viewer header (slice 4) uses `<Pill>` for the document's `fileType`.
 * `<Tooltip>` is wrapped on the outside when `truncated` is true so the
 * caller can present the full label on hover when CSS truncates the text.
 */

import { useEffect, useRef, useState } from 'react';

import { Tooltip } from '../Tooltip';

import styles from './Pill.module.scss';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'error';

interface Props {
  label: string;
  tone: Tone;
  ariaLabel?: string;
  truncated?: boolean;
}

const TONE_CLASS: Record<Tone, string> = {
  neutral: styles.toneNeutral,
  info: styles.toneInfo,
  success: styles.toneSuccess,
  warning: styles.toneWarning,
  error: styles.toneError,
};

export const Pill = ({ label, tone, ariaLabel, truncated = false }: Props) => {
  const labelRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    if (!truncated) return;
    const node = labelRef.current;
    if (!node) return;
    setIsOverflowing(node.scrollWidth > node.clientWidth);
  }, [truncated, label]);

  const pill = (
    <span
      className={`${styles.pill} ${TONE_CLASS[tone]} ${truncated ? styles.truncated : ''}`}
      aria-label={ariaLabel ?? label}
    >
      <span ref={labelRef} className={styles.label}>
        {label}
      </span>
    </span>
  );

  if (truncated && isOverflowing) {
    return <Tooltip content={label}>{pill}</Tooltip>;
  }

  return pill;
};
