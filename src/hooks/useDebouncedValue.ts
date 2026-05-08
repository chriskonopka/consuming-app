/**
 * Returns the input value after `ms` of stillness. Used by chat's status-row
 * fallback timing and (later) the viewer page-input debounce.
 */

import { useEffect, useState } from 'react';

export const useDebouncedValue = <T>(value: T, ms: number): T => {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebounced(value);
    }, ms);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [value, ms]);

  return debounced;
};
