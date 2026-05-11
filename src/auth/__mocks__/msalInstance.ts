/**
 * Manual mock for msalInstance — used by `jest.mock('./msalInstance')`.
 *
 * Tests that need MSAL behavior import this file's helpers via
 * `jest.requireMock('./msalInstance')` (or use the spy returned via
 * `import { msalInstance } from './msalInstance'` after enabling the mock).
 *
 * Default behaviour: no active account, no accounts, login/logout (popup AND
 * redirect variants) succeed synchronously, acquireTokenSilent returns a
 * fixed token, acquireTokenPopup also returns a fixed token,
 * handleRedirectPromise returns null. Tests override per-method via
 * `mockImplementation`.
 *
 * Production uses the redirect variants (popup flow caused circular sign-in
 * in modern Chrome — see `auth/AuthContext.tsx` header). Popup mocks remain
 * so callers that intentionally opt into popup can still be tested.
 */

import type { EventCallbackFunction } from '@azure/msal-browser';

const eventCallbacks: EventCallbackFunction[] = [];

// Minimal logger surface — @azure/msal-react's MsalProvider calls
// `instance.getLogger()` at mount; if we return undefined the component
// throws.
const noopLogger = {
  info: () => {},
  warning: () => {},
  error: () => {},
  verbose: () => {},
  trace: () => {},
  errorPii: () => {},
  warningPii: () => {},
  infoPii: () => {},
  verbosePii: () => {},
  tracePii: () => {},
  isPiiLoggingEnabled: () => false,
  setPii: () => {},
  setLogger: () => noopLogger,
  setCorrelationId: () => {},
  executeCallback: () => {},
  clone: () => noopLogger,
  hasPii: () => false,
};

const baseInstance = {
  initialize: jest.fn(async () => undefined),
  initializeWrapperLibrary: jest.fn(),
  getActiveAccount: jest.fn(() => null),
  getAllAccounts: jest.fn(() => [] as ReturnType<typeof Object>[]),
  setActiveAccount: jest.fn(),
  // Redirect variants — what production calls.
  loginRedirect: jest.fn(async () => undefined),
  logoutRedirect: jest.fn(async () => undefined),
  acquireTokenRedirect: jest.fn(async () => undefined),
  handleRedirectPromise: jest.fn(async () => null),
  // Popup variants retained for back-compat with any opt-in caller.
  loginPopup: jest.fn(async () => ({})),
  logoutPopup: jest.fn(async () => undefined),
  acquireTokenSilent: jest.fn(async () => ({ accessToken: 'mock-silent-token' })),
  acquireTokenPopup: jest.fn(async () => ({ accessToken: 'mock-popup-token' })),
  addEventCallback: jest.fn((cb: EventCallbackFunction) => {
    eventCallbacks.push(cb);
    return `cb-${eventCallbacks.length}`;
  }),
  removeEventCallback: jest.fn(),
  // Surface needed by @azure/msal-react's MsalProvider. Other methods on the
  // real PublicClientApplication are not exercised by tests; if a future
  // bump calls something new the resulting failure surfaces the gap.
  getLogger: jest.fn(() => noopLogger),
  setLogger: jest.fn(),
  addPerformanceCallback: jest.fn(() => 'perf-callback-id'),
  removePerformanceCallback: jest.fn(() => true),
  enableAccountStorageEvents: jest.fn(),
  disableAccountStorageEvents: jest.fn(),
  setNavigationClient: jest.fn(),
  getConfiguration: jest.fn(() => ({
    auth: { clientId: 'mock-client-id' },
    cache: { cacheLocation: 'sessionStorage' },
    system: {},
    telemetry: {},
  })),
};

export const msalInstance = baseInstance;
export const msalReady = Promise.resolve();
export const API_SCOPES: string[] = ['api://test/access'];

/** Test helper: dispatch an MSAL event to all registered callbacks. */
export const __emitMsalEvent = (event: unknown) => {
  for (const cb of eventCallbacks) {
    cb(event as never);
  }
};

/** Reset the spies between tests. Call from beforeEach. */
export const __resetMsalMock = () => {
  eventCallbacks.length = 0;
  Object.values(baseInstance).forEach((fn) => {
    if (typeof fn === 'function' && 'mockClear' in fn) {
      (fn as jest.Mock).mockClear();
    }
  });
  baseInstance.initialize.mockImplementation(async () => undefined);
  baseInstance.getActiveAccount.mockReturnValue(null);
  baseInstance.getAllAccounts.mockReturnValue([]);
  baseInstance.loginRedirect.mockImplementation(async () => undefined);
  baseInstance.logoutRedirect.mockImplementation(async () => undefined);
  baseInstance.acquireTokenRedirect.mockImplementation(async () => undefined);
  baseInstance.handleRedirectPromise.mockImplementation(async () => null);
  baseInstance.loginPopup.mockImplementation(async () => ({}));
  baseInstance.logoutPopup.mockImplementation(async () => undefined);
  baseInstance.acquireTokenSilent.mockImplementation(async () => ({
    accessToken: 'mock-silent-token',
  }));
  baseInstance.acquireTokenPopup.mockImplementation(async () => ({
    accessToken: 'mock-popup-token',
  }));
};
