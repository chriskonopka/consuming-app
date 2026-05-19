jest.mock('../appInsights', () => ({
  appInsights: { trackEvent: jest.fn() },
}));

import { appInsights } from '../appInsights';
import { __TESTING__, installStaleBundleReloader } from './staleBundleReloader';

const { RELOAD_GUARD_KEY, matchesStaleBundle, uninstall } = __TESTING__;

describe('matchesStaleBundle', () => {
  it.each([
    'ChunkLoadError: Loading chunk 256 failed',
    'Loading chunk 42 failed.',
    'Loading CSS chunk 5 failed',
    'Failed to fetch dynamically imported module: https://app/abc.js',
    'Failed to fetch ScriptResource for remoteEntry',
    "can't load remote mws_indexer",
    'Script load failed for https://app/main.abc.js',
  ])('matches %s', (text) => {
    expect(matchesStaleBundle(text)).toBe(true);
  });

  it.each([
    'TypeError: Cannot read properties of undefined',
    'NetworkError when attempting to fetch resource.',
    'AbortError: The user aborted a request.',
    '',
  ])('does not match unrelated error %s', (text) => {
    expect(matchesStaleBundle(text)).toBe(false);
  });
});

describe('installStaleBundleReloader', () => {
  let reloadMock: jest.Mock;
  let originalLocation: Location;
  let trackEventMock: jest.Mock;

  beforeEach(() => {
    window.sessionStorage.clear();
    trackEventMock = appInsights!.trackEvent as jest.Mock;
    trackEventMock.mockClear();
    reloadMock = jest.fn();
    originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: reloadMock },
    });
    installStaleBundleReloader();
  });

  afterEach(() => {
    uninstall();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('reloads on an unhandled rejection whose reason matches a stale-bundle marker', () => {
    window.dispatchEvent(
      new PromiseRejectionEvent('unhandledrejection', {
        reason: new Error('ChunkLoadError: Loading chunk 9 failed'),
        promise: Promise.reject(new Error('ChunkLoadError')).catch(() => undefined),
      }),
    );
    expect(reloadMock).toHaveBeenCalledTimes(1);
    expect(trackEventMock).toHaveBeenCalledWith({
      name: 'StaleBundleReload',
      properties: { cause: 'unhandledrejection' },
    });
  });

  it('reloads on an error event whose message matches a stale-bundle marker (federation script tag failure)', () => {
    window.dispatchEvent(
      new ErrorEvent('error', {
        message: "can't load remote mws_indexer",
        filename: 'https://indexer/__federation_expose_IndexerApp.abcd.js',
      }),
    );
    expect(reloadMock).toHaveBeenCalledTimes(1);
    expect(trackEventMock).toHaveBeenCalledWith({
      name: 'StaleBundleReload',
      properties: { cause: 'error' },
    });
  });

  it('does not reload on unrelated errors (axe regression: silent on AbortError)', () => {
    window.dispatchEvent(
      new PromiseRejectionEvent('unhandledrejection', {
        reason: new Error('AbortError: The operation was aborted.'),
        promise: Promise.reject(new Error('AbortError')).catch(() => undefined),
      }),
    );
    expect(reloadMock).not.toHaveBeenCalled();
    expect(trackEventMock).not.toHaveBeenCalled();
  });

  it('refuses to reload twice in a row — the sessionStorage guard breaks loops', () => {
    window.dispatchEvent(
      new PromiseRejectionEvent('unhandledrejection', {
        reason: new Error('ChunkLoadError'),
        promise: Promise.reject(new Error('ChunkLoadError')).catch(() => undefined),
      }),
    );
    window.dispatchEvent(
      new PromiseRejectionEvent('unhandledrejection', {
        reason: new Error('ChunkLoadError'),
        promise: Promise.reject(new Error('ChunkLoadError')).catch(() => undefined),
      }),
    );
    expect(reloadMock).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(RELOAD_GUARD_KEY)).toBe('1');
  });

  it('clears the guard on a healthy install so a future stale-chunk hit can still recover', () => {
    window.sessionStorage.setItem(RELOAD_GUARD_KEY, '1');
    // Simulate the next page load: the reloader installs fresh and clears
    // the latch left over from the previous session's emergency reload.
    uninstall();
    installStaleBundleReloader();
    expect(window.sessionStorage.getItem(RELOAD_GUARD_KEY)).toBeNull();
  });

  it('is idempotent on repeat install', () => {
    installStaleBundleReloader();
    installStaleBundleReloader();
    window.dispatchEvent(
      new PromiseRejectionEvent('unhandledrejection', {
        reason: new Error('ChunkLoadError'),
        promise: Promise.reject(new Error('ChunkLoadError')).catch(() => undefined),
      }),
    );
    // Despite three install() calls, only one reload fires for one event.
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });
});
