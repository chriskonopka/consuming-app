/**
 * Layout state reducer for the app shell. Owns chat panel + viewer panel
 * open/closed and width-px values. The panels themselves are rendered in
 * later slices; the state plumbing exists now so slice 3/4 don't refactor.
 *
 * `viewerPanel.open` is intentionally NOT persisted (per data-model.md §2.5
 * — it resets on each session). The persisted shape is a subset of LayoutState.
 */

import type { LayoutState, PanelState } from '@shared/types';
import { computeInitialPanelWidthPx } from '@shared/types';

export type LayoutAction =
  | { type: 'TOGGLE_CHAT_PANEL' }
  | { type: 'SET_CHAT_PANEL_WIDTH'; widthPx: number }
  | { type: 'TOGGLE_VIEWER_PANEL' }
  | { type: 'OPEN_VIEWER_PANEL' }
  | { type: 'CLOSE_VIEWER_PANEL' }
  | { type: 'SET_VIEWER_PANEL_WIDTH'; widthPx: number };

// Initial widths derived from viewport at module load — see
// `computeInitialPanelWidthPx` jsdoc. AppShell's clamp pins each panel's
// fraction-derived value to its own [min, max] range.
export const INITIAL_LAYOUT_STATE: LayoutState = {
  chatPanel: { open: false, widthPx: computeInitialPanelWidthPx() },
  viewerPanel: { open: false, widthPx: computeInitialPanelWidthPx() },
  theme: 'light',
};

const setPanel = (panel: PanelState, patch: Partial<PanelState>): PanelState => ({
  ...panel,
  ...patch,
});

export const layoutReducer = (state: LayoutState, action: LayoutAction): LayoutState => {
  switch (action.type) {
    case 'TOGGLE_CHAT_PANEL':
      return { ...state, chatPanel: setPanel(state.chatPanel, { open: !state.chatPanel.open }) };
    case 'SET_CHAT_PANEL_WIDTH':
      return { ...state, chatPanel: setPanel(state.chatPanel, { widthPx: action.widthPx }) };
    case 'TOGGLE_VIEWER_PANEL':
      return {
        ...state,
        viewerPanel: setPanel(state.viewerPanel, { open: !state.viewerPanel.open }),
      };
    case 'OPEN_VIEWER_PANEL':
      return { ...state, viewerPanel: setPanel(state.viewerPanel, { open: true }) };
    case 'CLOSE_VIEWER_PANEL':
      return { ...state, viewerPanel: setPanel(state.viewerPanel, { open: false }) };
    case 'SET_VIEWER_PANEL_WIDTH':
      return { ...state, viewerPanel: setPanel(state.viewerPanel, { widthPx: action.widthPx }) };
  }
};
