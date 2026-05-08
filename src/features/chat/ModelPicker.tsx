/**
 * Balanced (Claude) / Powerful (OpenAI) selector. Persists within session
 * but not across sessions per REQUIREMENTS.md §4.9.
 */

import type { ModelPickerOption } from '@shared/types';

import styles from './ModelPicker.module.css';

interface Props {
  value: ModelPickerOption;
  onChange: (next: ModelPickerOption) => void;
  disabled?: boolean;
}

const OPTIONS: ReadonlyArray<{ value: ModelPickerOption; label: string }> = [
  { value: 'Balanced', label: 'Balanced' },
  { value: 'Powerful', label: 'Powerful' },
];

export const ModelPicker = ({ value, onChange, disabled }: Props) => {
  return (
    <label className={styles.wrap}>
      <span className={styles.label}>Model</span>
      <select
        className={styles.select}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as ModelPickerOption)}
      >
        {OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
};
