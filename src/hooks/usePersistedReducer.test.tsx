import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { useEffect } from 'react';

import { idb } from '../utils/idb';
import { flushIDB } from '../test-utils';

import { usePersistedReducer } from './usePersistedReducer';

interface State {
  count: number;
  label: string;
}

type Action = { type: 'INC' } | { type: 'SET_LABEL'; label: string };

const initial: State = { count: 0, label: 'initial' };

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'INC':
      return { ...state, count: state.count + 1 };
    case 'SET_LABEL':
      return { ...state, label: action.label };
  }
};

const Probe = ({ storageKey, onState }: { storageKey: string; onState?: (s: State) => void }) => {
  const [state, dispatch] = usePersistedReducer(storageKey, reducer, initial);

  useEffect(() => {
    onState?.(state);
  }, [state, onState]);

  return (
    <div>
      <p data-testid="count">{state.count}</p>
      <p data-testid="label">{state.label}</p>
      <button type="button" onClick={() => dispatch({ type: 'INC' })}>
        increment
      </button>
      <button
        type="button"
        onClick={() => dispatch({ type: 'SET_LABEL', label: 'changed' })}
      >
        rename
      </button>
    </div>
  );
};

describe('usePersistedReducer', () => {
  it('starts from initialState before hydration completes', () => {
    render(<Probe storageKey="persistedReducer:fresh" />);
    expect(screen.getByTestId('count').textContent).toBe('0');
    expect(screen.getByTestId('label').textContent).toBe('initial');
  });

  it('hydrates from IndexedDB on mount, merging with initialState', async () => {
    await idb.set('persistedReducer:hydrate', { count: 5 });

    render(<Probe storageKey="persistedReducer:hydrate" />);
    await flushIDB();

    expect(screen.getByTestId('count').textContent).toBe('5');
    // Missing keys come from initialState
    expect(screen.getByTestId('label').textContent).toBe('initial');
  });

  it('persists state changes to IndexedDB after the debounce', async () => {
    const user = userEvent.setup();
    render(<Probe storageKey="persistedReducer:write" />);
    await flushIDB();

    await user.click(screen.getByRole('button', { name: 'increment' }));
    await user.click(screen.getByRole('button', { name: 'increment' }));

    // Allow the debounced write to flush.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    const stored = await idb.get<State>('persistedReducer:write');
    expect(stored?.count).toBe(2);
  });

  it('falls back to in-memory state when IndexedDB is unavailable', async () => {
    const user = userEvent.setup();
    const original = global.indexedDB;
    // @ts-expect-error -- intentional unset for the no-storage branch
    delete global.indexedDB;
    try {
      render(<Probe storageKey="persistedReducer:no-idb" />);
      await flushIDB();
      await user.click(screen.getByRole('button', { name: 'increment' }));
      expect(screen.getByTestId('count').textContent).toBe('1');
    } finally {
      global.indexedDB = original;
    }
  });

  it('renders without accessibility violations', async () => {
    const { container } = render(<Probe storageKey="persistedReducer:axe" />);
    await flushIDB();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
