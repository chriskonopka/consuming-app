/**
 * Both branches of the appInsights singleton:
 *   - without APPLICATIONINSIGHTS_CONNECTION_STRING → null (telemetry disabled)
 *   - with one set → an ApplicationInsights instance and loadAppInsights() called
 *
 * Uses jest.isolateModules so each branch reloads the module cleanly.
 */

const loadAppInsights = jest.fn();
const ApplicationInsightsCtor = jest.fn();
jest.mock('@microsoft/applicationinsights-web', () => ({
  ApplicationInsights: jest.fn().mockImplementation((cfg: unknown) => {
    ApplicationInsightsCtor(cfg);
    return { loadAppInsights };
  }),
}));

describe('appInsights singleton', () => {
  beforeEach(() => {
    loadAppInsights.mockClear();
    ApplicationInsightsCtor.mockClear();
  });

  it('returns null when no connection string is configured', () => {
    jest.isolateModules(() => {
      // process.env.APPLICATIONINSIGHTS_CONNECTION_STRING undefined in the
      // jest test runtime — the module-level branch should yield null.
      const original = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
      delete process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { appInsights } = require('./appInsights');
        expect(appInsights).toBeNull();
        expect(ApplicationInsightsCtor).not.toHaveBeenCalled();
      } finally {
        if (original !== undefined) {
          process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = original;
        }
      }
    });
  });

  it('initializes an ApplicationInsights instance when a connection string is set', () => {
    jest.isolateModules(() => {
      process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = 'InstrumentationKey=test;';
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { appInsights } = require('./appInsights');
        expect(appInsights).not.toBeNull();
        expect(ApplicationInsightsCtor).toHaveBeenCalledWith({
          config: { connectionString: 'InstrumentationKey=test;' },
        });
        expect(loadAppInsights).toHaveBeenCalled();
      } finally {
        delete process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
      }
    });
  });
});
