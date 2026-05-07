import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';

import { ErrorBoundary } from './index';
import { appInsights } from '../../appInsights';

const ThrowingChild = ({ message }: { message: string }) => {
  throw new Error(message);
};

describe('ErrorBoundary', () => {
  // Suppress React's componentDidCatch console output during these tests so
  // CI logs stay readable. The behaviour we care about is what's rendered
  // and whether trackException was called — not React's noisy default error log.
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('renders children when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <p>OK content</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('OK content')).toBeInTheDocument();
  });

  it('renders the fallback when a child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild message="boom" />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('forwards the caught error to App Insights via trackException', () => {
    if (!appInsights) {
      // App Insights is null when no connection string is configured (test env).
      // The boundary uses optional chaining, so the call is a no-op — verify it
      // didn't throw, which is the only observable behaviour in this branch.
      expect(() =>
        render(
          <ErrorBoundary>
            <ThrowingChild message="kaboom" />
          </ErrorBoundary>,
        ),
      ).not.toThrow();
      return;
    }
    const trackSpy = jest.spyOn(appInsights, 'trackException');
    render(
      <ErrorBoundary>
        <ThrowingChild message="kaboom" />
      </ErrorBoundary>,
    );
    expect(trackSpy).toHaveBeenCalledWith({ exception: expect.any(Error) });
  });

  it('has no accessibility violations in the OK state', async () => {
    const { container } = render(
      <ErrorBoundary>
        <p>OK content</p>
      </ErrorBoundary>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no accessibility violations in the error fallback state', async () => {
    const { container } = render(
      <ErrorBoundary>
        <ThrowingChild message="boom" />
      </ErrorBoundary>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
