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

/**
 * IndexedDB persistence key for the consolidated LayoutState reducer.
 *
 * Slice 1 stores the entire LayoutState under one key rather than the three
 * per-field keys originally sketched in data-model.md §3. One reducer, one
 * write, atomic rehydration. See `docs/architecture/data-model.md` §3 for
 * the rationale.
 */
export const LAYOUT_STORAGE_KEY = 'consuming-app:layout' as const;

/** localStorage key — the only sanctioned one per web-persistence.md. */
export const THEME_PREFERENCE_KEY = 'theme-preference';

/** Default panel widths — REQUIREMENTS.md §6.1 (no exact value specified; reasonable starting points). */
export const DEFAULT_CHAT_PANEL_WIDTH_PX = 400;
export const DEFAULT_VIEWER_PANEL_WIDTH_PX = 720;
