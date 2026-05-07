/**
 * App-shell layout state — owned by app-shell (via shared usePersistedReducer).
 */

export type Theme = 'light' | 'dark';

export interface PanelState {
  open: boolean;
  widthPx: number;
}

export interface LayoutState {
  chatPanel: PanelState;
  viewerPanel: PanelState;
  theme: Theme;
}

/** IndexedDB persistence keys — stable, namespaced. */
export const PERSISTENCE_KEYS = {
  chatPanelWidth: 'consuming-app:chat-panel-width',
  viewerPanelWidth: 'consuming-app:viewer-panel-width',
  chatPanelOpen: 'consuming-app:chat-panel-open',
} as const;

/** localStorage key — the only sanctioned one per web-persistence.md. */
export const THEME_PREFERENCE_KEY = 'theme-preference';

/** Default panel widths — REQUIREMENTS.md §6.1 (no exact value specified; reasonable starting points). */
export const DEFAULT_CHAT_PANEL_WIDTH_PX = 400;
export const DEFAULT_VIEWER_PANEL_WIDTH_PX = 600;
