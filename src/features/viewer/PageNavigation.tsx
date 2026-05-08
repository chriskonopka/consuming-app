/**
 * Page-navigation controls for the document viewer.
 *
 * Surface (REQUIREMENTS.md §5.8):
 *   - Numeric page input (typed page number, commits on blur or Enter).
 *   - Previous/Next buttons.
 *   - Current page / total pages always visible.
 *   - PageUp/Down keyboard handling lives on the panel-level keydown listener.
 */

import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';

import { IconButton } from '../../components/IconButton';

import styles from './PageNavigation.module.scss';

interface Props {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export const PageNavigation = ({ page, totalPages, onPageChange, disabled }: Props) => {
  const [draft, setDraft] = useState(String(page));

  // Keep draft in sync with the canonical page when it changes (e.g. via
  // PageUp/Down on the panel or navigation arrows).
  useEffect(() => {
    setDraft(String(page));
  }, [page]);

  const commit = (value: string): void => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || totalPages < 1) {
      setDraft(String(page));
      return;
    }
    const clamped = clamp(parsed, 1, totalPages);
    setDraft(String(clamped));
    if (clamped !== page) onPageChange(clamped);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    commit(draft);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setDraft(event.target.value);
  };

  const goToPrevious = (): void => {
    if (page > 1) onPageChange(page - 1);
  };

  const goToNext = (): void => {
    if (page < totalPages) onPageChange(page + 1);
  };

  const navDisabled = disabled || totalPages < 1;

  return (
    <form className={styles.nav} onSubmit={handleSubmit} aria-label="Page navigation">
      <IconButton
        icon={CaretLeft}
        ariaLabel="Previous page"
        onClick={goToPrevious}
        disabled={navDisabled || page <= 1}
      />
      <label className={styles.label}>
        <span className={styles.srOnly}>Go to page</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={Math.max(totalPages, 1)}
          className={styles.input}
          value={draft}
          onChange={handleChange}
          onBlur={() => commit(draft)}
          disabled={navDisabled}
        />
      </label>
      <span className={styles.total} aria-live="polite">
        of {totalPages || '—'}
      </span>
      <IconButton
        icon={CaretRight}
        ariaLabel="Next page"
        onClick={goToNext}
        disabled={navDisabled || page >= totalPages}
      />
    </form>
  );
};
