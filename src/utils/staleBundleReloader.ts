/**
 * Catches webpack chunk-load failures and Module-Federation remote-load
 * failures that surface after a deploy invalidates the user's currently
 * loaded bundle. The user's tab is running an old `main.<hash>.js`; any
 * `React.lazy` import or federated submodule that hasn't been pulled yet
 * tries to fetch a hashed URL that no longer exists on the CDN (Azure SWA
 * doesn't retain old artifacts). Without this handler, the failure
 * surfaces as an unhandled promise rejection and the affected feature
 * appears silently broken — most visibly, the indexer's federated
 * submodules fail to load when the user tries to interact with a
 * collection.
 *
 * The handler force-reloads on a recognised stale-bundle error, guarded by
 * a `sessionStorage` flag so a genuinely-broken deploy doesn't loop. The
 * polite "new version available → reload on tab-hidden" path
 * (`useReloadOnNewVersion`) catches most users before they hit this; the
 * reloader is the emergency backstop for the case where they don't.
 *
 * Telemetry: emits an `appInsights.trackEvent` so we can measure how often
 * this fires in production vs. the gentler version-poll path. No PII.
 */

import { appInsights } from '../appInsights';

const RELOAD_GUARD_KEY = 'stale-bundle-reloaded';

/**
 * Tracks substrings + regex patterns that mark a fetch-a-chunk-and-it-was-
 * gone error. Kept narrow on purpose — false positives would loop the page
 * even with the guard (it clears on subsequent loads).
 *
 *   - webpack: `ChunkLoadError`, `Loading chunk N failed`, `Loading CSS chunk N failed`
 *   - ES dynamic import: `Failed to fetch dynamically imported module`
 *   - @module-federation/enhanced: `Failed to fetch ScriptResource`,
 *     `can't load remote`, and the generic `script load failed` for
 *     remoteEntry/federated chunks
 */
const STALE_BUNDLE_MARKERS: ReadonlyArray<string | RegExp> = [
  'ChunkLoadError',
  'Loading chunk',
  'Loading CSS chunk',
  'Failed to fetch dynamically imported module',
  'Failed to fetch ScriptResource',
  "can't load remote",
  /script load failed.*\.(?:js|mjs|css)/i,
];

const matchesStaleBundle = (text: string): boolean => {
  for (const marker of STALE_BUNDLE_MARKERS) {
    if (typeof marker === 'string') {
      if (text.includes(marker)) return true;
    } else if (marker.test(text)) {
      return true;
    }
  }
  return false;
};

/** Coerce arbitrary thrown values into a message string for matching. */
const errorText = (reason: unknown): string => {
  if (reason instanceof Error) return reason.message + ' ' + (reason.stack ?? '');
  if (typeof reason === 'string') return reason;
  try {
    return String(reason);
  } catch {
    return '';
  }
};

const reload = (cause: string): void => {
  // Storage may be disabled (private-mode, quota-exceeded). Failing the
  // guard read defaults to "haven't reloaded yet" — safer to attempt the
  // recovery than to loop, because the next load will set the flag.
  try {
    if (window.sessionStorage.getItem(RELOAD_GUARD_KEY)) return;
    window.sessionStorage.setItem(RELOAD_GUARD_KEY, '1');
  } catch {
    // Swallow — proceed with reload.
  }
  appInsights?.trackEvent({
    name: 'StaleBundleReload',
    properties: { cause },
  });
  window.location.reload();
};

const onUnhandledRejection = (event: PromiseRejectionEvent): void => {
  if (matchesStaleBundle(errorText(event.reason))) reload('unhandledrejection');
};

const onError = (event: ErrorEvent): void => {
  // ErrorEvent fires for script tags that fail to load (the dominant case
  // for module-federation remote chunks served from a different origin).
  // event.message + event.filename together cover both webpack and MF.
  const text = `${event.message ?? ''} ${event.filename ?? ''} ${errorText(event.error)}`;
  if (matchesStaleBundle(text)) reload('error');
};

let installed = false;

/**
 * Install the global handlers. Called once from `bootstrap.tsx` before any
 * `React.lazy` boundary mounts. Idempotent — repeated calls are no-ops.
 */
export const installStaleBundleReloader = (): void => {
  if (installed) return;
  installed = true;
  // Successful module load → clear the guard so a future stale-chunk hit
  // can recover. We treat `bootstrap.tsx` executing as proof the current
  // bundle is healthy.
  try {
    window.sessionStorage.removeItem(RELOAD_GUARD_KEY);
  } catch {
    // ignore
  }
  window.addEventListener('unhandledrejection', onUnhandledRejection);
  window.addEventListener('error', onError);
};

/** Exported for tests. */
export const __TESTING__ = {
  RELOAD_GUARD_KEY,
  matchesStaleBundle,
  uninstall: (): void => {
    window.removeEventListener('unhandledrejection', onUnhandledRejection);
    window.removeEventListener('error', onError);
    installed = false;
  },
};
