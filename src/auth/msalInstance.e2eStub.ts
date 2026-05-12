/**
 * Playwright stub for `PublicClientApplication`. Used only when the build
 * is invoked with `MSAL_E2E_STUB=true` (set by `playwright.config.ts`'s
 * webServer.env). Production builds never include this code path —
 * Webpack's DefinePlugin + Terser dead-code-eliminate the entire branch
 * because the gating expression `process.env.MSAL_E2E_STUB === 'true'`
 * folds to `false` when the env var isn't set.
 *
 * Behaviour: loginPopup / loginRedirect synchronously create a deterministic
 * fake account and emit LOGIN_SUCCESS; logoutPopup / logoutRedirect clear
 * it and emit LOGOUT_SUCCESS. Token acquisition returns a fixed string.
 * Redirect variants do NOT actually navigate — they short-circuit to the
 * same in-memory state mutation as the popup variants so jest/playwright
 * specs do not need to simulate a real top-level browser navigation. Enough
 * for the sign-in / sign-out / theme-persist flow the slice-1 e2e covers.
 */

import {
  EventType,
  type AccountInfo,
  type AuthenticationResult,
  type EndSessionPopupRequest,
  type EventCallbackFunction,
  type PopupRequest,
  type PublicClientApplication,
  type SilentRequest,
} from '@azure/msal-browser';

const STUB_ACCOUNT: AccountInfo = {
  homeAccountId: 'stub-home-account-id',
  environment: 'login.microsoftonline.com',
  tenantId: 'stub-tenant-id',
  username: 'e2e-user@example.com',
  localAccountId: 'stub-local-account-id',
  name: 'E2E User',
};

interface State {
  activeAccount: AccountInfo | null;
}

const STUB_SESSION_KEY = 'msal-e2e-stub-active';

const loadInitialActive = (): AccountInfo | null => {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STUB_SESSION_KEY);
    return raw ? (JSON.parse(raw) as AccountInfo) : null;
  } catch {
    return null;
  }
};

const persistActive = (account: AccountInfo | null): void => {
  if (typeof sessionStorage === 'undefined') return;
  try {
    if (account) {
      sessionStorage.setItem(STUB_SESSION_KEY, JSON.stringify(account));
    } else {
      sessionStorage.removeItem(STUB_SESSION_KEY);
    }
  } catch {
    // Ignore — storage failures are non-fatal in the stub.
  }
};

const state: State = { activeAccount: loadInitialActive() };
const callbacks = new Map<string, EventCallbackFunction>();

const emit = (eventType: EventType, payload?: unknown) => {
  for (const cb of callbacks.values()) {
    cb({ eventType, interactionType: 'popup', payload, timestamp: Date.now() } as never);
  }
};

const stubResult = (account: AccountInfo): AuthenticationResult => ({
  authority: 'https://login.microsoftonline.com/stub',
  uniqueId: 'stub-unique-id',
  tenantId: account.tenantId,
  scopes: [],
  account,
  idToken: 'stub-id-token',
  idTokenClaims: {},
  accessToken: 'stub-access-token',
  fromCache: false,
  expiresOn: new Date(Date.now() + 60 * 60 * 1000),
  tokenType: 'Bearer',
  correlationId: 'stub-correlation-id',
});

/**
 * Minimal logger that swallows everything. @azure/msal-react's MsalProvider
 * calls `instance.getLogger()` at mount; if we return undefined the
 * component throws.
 */
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

export const e2eMsalStub: PublicClientApplication = {
  initialize: async () => undefined,
  initializeWrapperLibrary: () => undefined,
  getActiveAccount: () => state.activeAccount,
  getAllAccounts: () => (state.activeAccount ? [state.activeAccount] : []),
  setActiveAccount: (account: AccountInfo | null) => {
    state.activeAccount = account;
    persistActive(account);
  },
  loginPopup: async (_req?: PopupRequest) => {
    state.activeAccount = STUB_ACCOUNT;
    persistActive(STUB_ACCOUNT);
    emit(EventType.LOGIN_SUCCESS, { account: STUB_ACCOUNT });
    return stubResult(STUB_ACCOUNT);
  },
  loginRedirect: async () => {
    // Production calls this; the stub short-circuits the redirect-back step
    // so the same LOGIN_SUCCESS event the real redirect-handler would fire
    // is emitted synchronously, letting AuthContext's event handler flip
    // state to AUTHENTICATED without a page reload in tests.
    state.activeAccount = STUB_ACCOUNT;
    persistActive(STUB_ACCOUNT);
    emit(EventType.LOGIN_SUCCESS, { account: STUB_ACCOUNT });
  },
  logoutPopup: async (_req?: EndSessionPopupRequest) => {
    state.activeAccount = null;
    persistActive(null);
    emit(EventType.LOGOUT_SUCCESS);
  },
  logoutRedirect: async () => {
    // Mirror loginRedirect: in production this navigates; in the stub we
    // emit LOGOUT_SUCCESS synchronously so the same AuthContext path runs.
    state.activeAccount = null;
    persistActive(null);
    emit(EventType.LOGOUT_SUCCESS);
  },
  logout: async () => undefined,
  acquireTokenSilent: async (_req: SilentRequest) =>
    stubResult(state.activeAccount ?? STUB_ACCOUNT),
  acquireTokenPopup: async (_req: PopupRequest) =>
    stubResult(state.activeAccount ?? STUB_ACCOUNT),
  acquireTokenRedirect: async () => undefined,
  acquireTokenByCode: async (_req: SilentRequest) =>
    stubResult(state.activeAccount ?? STUB_ACCOUNT),
  ssoSilent: async (_req: SilentRequest) =>
    stubResult(state.activeAccount ?? STUB_ACCOUNT),
  handleRedirectPromise: async () => null,
  addEventCallback: (cb: EventCallbackFunction) => {
    const id = `e2e-${callbacks.size + 1}`;
    callbacks.set(id, cb);
    return id;
  },
  removeEventCallback: (id: string) => {
    callbacks.delete(id);
  },
  addPerformanceCallback: () => 'perf-callback-id',
  removePerformanceCallback: () => true,
  enableAccountStorageEvents: () => undefined,
  disableAccountStorageEvents: () => undefined,
  getAccountByHomeId: () => state.activeAccount,
  getAccountByLocalId: () => state.activeAccount,
  getAccountByUsername: () => state.activeAccount,
  getAccount: () => state.activeAccount,
  setNavigationClient: () => undefined,
  getConfiguration: () => ({
    auth: { clientId: 'stub-client-id' },
    cache: { cacheLocation: 'sessionStorage' },
    system: {},
    telemetry: {},
  }),
  getLogger: () => noopLogger,
  setLogger: () => undefined,
  clearCache: async () => undefined,
  hydrateCache: async () => undefined,
  getRedirectResponse: () => new Map(),
  // Cast to PublicClientApplication — the surface above covers the methods
  // both our auth code and @azure/msal-react's MsalProvider call. Anything
  // unused stays unimplemented; if a future MSAL bump calls something new,
  // the resulting runtime error surfaces the gap explicitly.
} as unknown as PublicClientApplication;
