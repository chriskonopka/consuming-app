/**
 * Polls `GET /version.json` while the tab is visible. When the live `buildId`
 * differs from the one baked into this bundle (via `webpack.DefinePlugin`),
 * the tab is reloaded as soon as the user navigates away — `visibilitychange`
 * to `hidden`. The user never sees a prompt; the next time they return to
 * the tab they're on the new bundle, with no in-progress work clobbered.
 *
 * Backstops (handled elsewhere — out of scope for this hook):
 *   - `staleBundleReloader` catches the case where the user triggers a
 *     stale-chunk fetch before the visibility-hidden reload fires.
 *   - If the user keeps the tab focused for the long tail, they keep the
 *     stale bundle until either backstop trips. Acceptable for the
 *     internal-dev rollout audience; revisit if it bites production.
 *
 * Polling intentionally pauses when the tab is hidden (no point burning
 * cycles on a backgrounded tab) and re-fires immediately on the next
 * visibility-visible event so users who tab back after a long break get
 * the update detection promptly.
 */

import { useEffect, useRef } from 'react';

import { appInsights } from '../appInsights';
import { BUILD_ID } from '../utils/buildId';

const VERSION_URL = '/version.json';
const POLL_INTERVAL_MS = 60 * 1000;

interface VersionResponse {
  buildId: string;
}

/**
 * Fetch the live version manifest. Returns null on network/parse error so
 * the polling loop keeps trying — the next deploy may be the one that
 * matters, and a transient blip shouldn't poison the loop.
 */
const fetchLiveBuildId = async (signal: AbortSignal): Promise<string | null> => {
  try {
    const response = await fetch(VERSION_URL, {
      signal,
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const body = (await response.json()) as VersionResponse;
    return typeof body.buildId === 'string' ? body.buildId : null;
  } catch {
    return null;
  }
};

/**
 * Hook intended to be called once, near the top of the signed-in tree
 * (`AppShell`). Mounting it twice would double the poll cadence — guard
 * higher up if that becomes a risk.
 *
 * In dev builds the baked-in BUILD_ID is the local git short SHA; the live
 * `version.json` matches, so this hook is a no-op locally.
 */
export const useReloadOnNewVersion = (): void => {
  // Track the latest live build id without re-rendering on every poll.
  // The reducer only cares whether `live !== baked` at the moment a
  // visibility-hidden event fires.
  const pendingUpdateRef = useRef(false);

  useEffect(() => {
    const abortController = new AbortController();
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const check = async (): Promise<void> => {
      if (cancelled) return;
      const liveBuildId = await fetchLiveBuildId(abortController.signal);
      if (cancelled || liveBuildId === null) return;
      if (liveBuildId !== BUILD_ID && !pendingUpdateRef.current) {
        pendingUpdateRef.current = true;
        appInsights?.trackEvent({
          name: 'NewVersionDetected',
          // Only emit the bucket the deploy is on, not full ids — the value
          // is non-sensitive but trims telemetry noise on rapid deploys.
          properties: { detection: 'poll' },
        });
      }
    };

    const schedule = (): void => {
      if (cancelled) return;
      if (document.visibilityState === 'hidden') return;
      pollTimer = setTimeout(() => {
        void check().then(schedule);
      }, POLL_INTERVAL_MS);
    };

    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') {
        // Tab is leaving the foreground — if a new version is pending, this
        // is our cue to reload. The user is mid-tab-switch, so no in-task
        // work is interrupted.
        if (pendingUpdateRef.current) {
          appInsights?.trackEvent({
            name: 'StaleBundleReload',
            properties: { cause: 'visibility-hidden' },
          });
          // Brief defer so any in-flight telemetry beacon has a chance to
          // dispatch before the page unloads. `trackEvent` is async-batched.
          window.setTimeout(() => window.location.reload(), 0);
        }
        if (pollTimer !== null) {
          clearTimeout(pollTimer);
          pollTimer = null;
        }
        return;
      }
      // Tab returned to visible — re-check immediately (the user may have
      // been gone for hours) then resume the regular cadence.
      if (pollTimer !== null) {
        clearTimeout(pollTimer);
        pollTimer = null;
      }
      void check().then(schedule);
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    // Kick off the first poll immediately so we catch deploys that landed
    // while the user was on another tab before opening this one.
    void check().then(schedule);

    return () => {
      cancelled = true;
      abortController.abort();
      if (pollTimer !== null) clearTimeout(pollTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);
};

/** Exported for tests. */
export const __TESTING__ = {
  POLL_INTERVAL_MS,
  VERSION_URL,
};
