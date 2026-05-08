/**
 * Layout state hook — wraps `usePersistedReducer` so panel open/closed and
 * widths survive a reload. Persistence key comes from `@shared/types`.
 *
 * `viewerPanel.open` resets each session per data-model.md §2.5 — it's
 * persisted as part of LayoutState but a post-hydrate effect flips it back
 * to false. Keeping the reducer pure means feature slices can dispatch
 * OPEN_VIEWER_PANEL without worrying about persistence semantics.
 */

import { useEffect, type Dispatch } from 'react';

import { LAYOUT_STORAGE_KEY, type LayoutState } from '@shared/types';

import { usePersistedReducer } from '../hooks/usePersistedReducer';

import {
  INITIAL_LAYOUT_STATE,
  layoutReducer,
  type LayoutAction,
} from './layoutReducer';

export interface UseLayoutStateReturn {
  state: LayoutState;
  dispatch: Dispatch<LayoutAction>;
}

export const useLayoutState = (): UseLayoutStateReturn => {
  const [state, dispatch] = usePersistedReducer<LayoutState, LayoutAction>(
    LAYOUT_STORAGE_KEY,
    layoutReducer,
    INITIAL_LAYOUT_STATE,
  );

  useEffect(() => {
    if (state.viewerPanel.open) {
      dispatch({ type: 'CLOSE_VIEWER_PANEL' });
    }
  }, [state.viewerPanel.open, dispatch]);

  return { state, dispatch };
};
