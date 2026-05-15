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

/**
 * Initial panel width on first paint — 33% of the viewport. Each panel
 * (chat and viewer) uses the same fraction; AppShell's clamp pins the
 * result to the per-panel `[min, max]` range. Once the user drags either
 * panel, the new pixel value is persisted to IndexedDB and supersedes
 * this on subsequent loads, so the panel never resnaps on viewport
 * resize. The fallback (used in jsdom/SSR where `window` is missing) is
 * a reasonable mid-range pixel value that survives the same clamp.
 */
export const INITIAL_PANEL_WIDTH_FRACTION = 0.33;
const INITIAL_PANEL_WIDTH_FALLBACK_PX = 400;
export const computeInitialPanelWidthPx = (): number => {
  if (typeof window === 'undefined') return INITIAL_PANEL_WIDTH_FALLBACK_PX;
  return Math.round(window.innerWidth * INITIAL_PANEL_WIDTH_FRACTION);
};
