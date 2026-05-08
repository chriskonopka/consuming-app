import { act, render } from '@testing-library/react';

import { idb } from '../utils/idb';
import { flushIDB } from '../test-utils';
import { LAYOUT_STORAGE_KEY, type LayoutState } from '@shared/types';

import { INITIAL_LAYOUT_STATE } from './layoutReducer';
import { useLayoutState } from './useLayoutState';

const Probe = ({ onState }: { onState: (s: LayoutState) => void }) => {
  const { state, dispatch } = useLayoutState();
  onState(state);
  return (
    <button
      type="button"
      onClick={() => dispatch({ type: 'SET_CHAT_PANEL_WIDTH', widthPx: 480 })}
    >
      change-width
    </button>
  );
};

describe('useLayoutState', () => {
  it('returns initial state on first render', () => {
    const seen = jest.fn();
    render(<Probe onState={seen} />);
    expect(seen).toHaveBeenCalledWith(INITIAL_LAYOUT_STATE);
  });

  it('hydrates from IndexedDB on mount', async () => {
    await idb.set(LAYOUT_STORAGE_KEY, {
      chatPanel: { open: true, widthPx: 720 },
      viewerPanel: { open: false, widthPx: 700 },
      theme: 'light',
    });
    const seen = jest.fn();
    render(<Probe onState={seen} />);
    await flushIDB();
    const last = seen.mock.calls[seen.mock.calls.length - 1][0];
    expect(last.chatPanel).toEqual({ open: true, widthPx: 720 });
  });

  it('resets viewerPanel.open to false after hydration', async () => {
    await idb.set(LAYOUT_STORAGE_KEY, {
      ...INITIAL_LAYOUT_STATE,
      viewerPanel: { open: true, widthPx: 600 },
    });
    const seen = jest.fn();
    render(<Probe onState={seen} />);
    await flushIDB();
    const last = seen.mock.calls[seen.mock.calls.length - 1][0];
    expect(last.viewerPanel.open).toBe(false);
    expect(last.viewerPanel.widthPx).toBe(600);
  });

  it('persists state changes back to IndexedDB', async () => {
    const seen = jest.fn();
    const { getByRole } = render(<Probe onState={seen} />);
    await flushIDB();

    await act(async () => {
      getByRole('button', { name: 'change-width' }).click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    const stored = await idb.get<LayoutState>(LAYOUT_STORAGE_KEY);
    expect(stored?.chatPanel.widthPx).toBe(480);
  });
});
