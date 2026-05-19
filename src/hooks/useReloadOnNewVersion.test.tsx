jest.mock('../appInsights', () => ({
  appInsights: { trackEvent: jest.fn() },
}));

jest.mock('../utils/buildId', () => ({
  BUILD_ID: 'baked-build-id',
}));

import { render, act, waitFor } from '@testing-library/react';

import { appInsights } from '../appInsights';
import { __TESTING__, useReloadOnNewVersion } from './useReloadOnNewVersion';

const { POLL_INTERVAL_MS } = __TESTING__;

const Probe = (): null => {
  useReloadOnNewVersion();
  return null;
};

const setVisibility = (state: 'visible' | 'hidden'): void => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event('visibilitychange'));
};

const respondWithBuildId = (id: string | null): Response =>
  new Response(id === null ? '' : JSON.stringify({ buildId: id }), {
    status: id === null ? 500 : 200,
    headers: { 'content-type': 'application/json' },
  });

describe('useReloadOnNewVersion', () => {
  let fetchMock: jest.Mock;
  let reloadMock: jest.Mock;
  let originalLocation: Location;
  let trackEventMock: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    setVisibility('visible');
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    reloadMock = jest.fn();
    originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: reloadMock },
    });
    trackEventMock = appInsights!.trackEvent as jest.Mock;
    trackEventMock.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('does not reload while the live build id matches the baked id', async () => {
    fetchMock.mockResolvedValue(respondWithBuildId('baked-build-id'));
    render(<Probe />);
    // Drain the initial poll's microtasks.
    await act(async () => {
      await Promise.resolve();
    });
    setVisibility('hidden');
    expect(reloadMock).not.toHaveBeenCalled();
    expect(trackEventMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: 'StaleBundleReload' }),
    );
  });

  it('fires NewVersionDetected when the live id diverges, then reloads on the next visibility-hidden', async () => {
    fetchMock.mockResolvedValue(respondWithBuildId('new-build-id'));
    render(<Probe />);
    await waitFor(() =>
      expect(trackEventMock).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'NewVersionDetected' }),
      ),
    );
    expect(reloadMock).not.toHaveBeenCalled();

    setVisibility('hidden');
    // The reload is dispatched on the next macrotask so any in-flight
    // telemetry beacon flushes; advance fake timers past the 0ms defer.
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(reloadMock).toHaveBeenCalledTimes(1);
    expect(trackEventMock).toHaveBeenCalledWith({
      name: 'StaleBundleReload',
      properties: { cause: 'visibility-hidden' },
    });
  });

  it('does not reload when the tab is hidden but no new version has been detected', async () => {
    fetchMock.mockResolvedValue(respondWithBuildId('baked-build-id'));
    render(<Probe />);
    await act(async () => {
      await Promise.resolve();
    });
    setVisibility('hidden');
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it('pauses polling while the tab is hidden and re-polls immediately on visibility-visible', async () => {
    fetchMock.mockResolvedValue(respondWithBuildId('baked-build-id'));
    render(<Probe />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    setVisibility('hidden');
    // While hidden, advancing time shouldn't trigger additional polls.
    act(() => {
      jest.advanceTimersByTime(POLL_INTERVAL_MS * 3);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Returning to visible re-fires the poll immediately, then resumes
    // the cadence (not under test here — just the immediate re-check).
    setVisibility('visible');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('treats a non-200 / unparseable /version.json as transient and keeps polling', async () => {
    fetchMock.mockResolvedValueOnce(respondWithBuildId(null)); // 500
    fetchMock.mockResolvedValueOnce(respondWithBuildId('new-build-id')); // recovers
    render(<Probe />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(trackEventMock).not.toHaveBeenCalled();

    // Advance to the next poll tick.
    act(() => {
      jest.advanceTimersByTime(POLL_INTERVAL_MS);
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(trackEventMock).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'NewVersionDetected' }),
      ),
    );
  });
});
