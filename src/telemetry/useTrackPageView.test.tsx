jest.mock('../appInsights', () => ({
  appInsights: { trackPageView: jest.fn() },
}));

import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { act } from 'react';

import { useTrackPageView } from './useTrackPageView';

const mockedAppInsights = jest.requireMock('../appInsights').appInsights as {
  trackPageView: jest.Mock;
};

// Logic-only hook (no DOM output) — no axe assertion.

const Tracker = () => {
  useTrackPageView();
  return null;
};

let externalNavigate: ((to: string) => void) | null = null;
const NavigatorBridge = () => {
  externalNavigate = useNavigate();
  return null;
};

beforeEach(() => {
  mockedAppInsights.trackPageView.mockClear();
  externalNavigate = null;
});

describe('useTrackPageView', () => {
  it('fires trackPageView on the initial route', () => {
    render(
      <MemoryRouter initialEntries={['/start']}>
        <Tracker />
      </MemoryRouter>,
    );
    expect(mockedAppInsights.trackPageView).toHaveBeenCalledWith({
      name: '/start',
      uri: '/start',
    });
  });

  it('fires once per pathname change, ignoring the query string', () => {
    render(
      <MemoryRouter initialEntries={['/first']}>
        <Tracker />
        <NavigatorBridge />
        <Routes>
          <Route path="*" element={null} />
        </Routes>
      </MemoryRouter>,
    );
    mockedAppInsights.trackPageView.mockClear();

    act(() => {
      externalNavigate?.('/second?keep=secret');
    });

    expect(mockedAppInsights.trackPageView).toHaveBeenCalledTimes(1);
    expect(mockedAppInsights.trackPageView).toHaveBeenCalledWith({
      name: '/second',
      uri: '/second',
    });
  });
});
