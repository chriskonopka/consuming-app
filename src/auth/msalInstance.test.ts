/**
 * Coverage test for the msalInstance singleton. Mocks @azure/msal-browser at
 * the package level (not the local file) so the real module-load code path
 * is exercised.
 */

const initialize = jest.fn(async () => undefined);
const PublicClientApplicationCtor = jest.fn();

jest.mock('@azure/msal-browser', () => ({
  PublicClientApplication: jest.fn().mockImplementation((cfg: unknown) => {
    PublicClientApplicationCtor(cfg);
    return { initialize };
  }),
}));

describe('msalInstance singleton', () => {
  it('builds the MSAL instance using config + window-derived redirectUri', async () => {
    const mod = await import('./msalInstance');
    expect(PublicClientApplicationCtor).toHaveBeenCalledTimes(1);
    const config = PublicClientApplicationCtor.mock.calls[0][0] as {
      auth: { redirectUri: string };
      cache: { cacheLocation: string };
    };
    expect(config.auth.redirectUri).toBe(window.location.origin);
    expect(config.cache.cacheLocation).toBe('sessionStorage');

    expect(initialize).toHaveBeenCalled();
    await expect(mod.msalReady).resolves.toBeUndefined();
    expect(mod.msalInstance).toBeDefined();
    expect(Array.isArray(mod.API_SCOPES)).toBe(true);
  });
});
