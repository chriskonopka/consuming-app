import {
  isAppInsightsConfigured,
  validateConfig,
  type Config,
} from './env';

const fullyConfigured: Config = {
  apiBaseUrl: 'https://api.example.com',
  indexerRemoteUrl: 'https://indexer.example.com',
  msalClientId: '00000000-0000-0000-0000-000000000000',
  msalAuthority: 'https://login.microsoftonline.com/tenant',
  msalApiScope: 'api://app/access_as_user',
  appInsightsConnectionString: 'InstrumentationKey=...',
};

describe('validateConfig', () => {
  it('returns status=ok when every required key is set', () => {
    const result = validateConfig(fullyConfigured);
    expect(result.status).toBe('ok');
    expect(result.missing).toEqual([]);
  });

  it('returns status=degraded with the missing keys when some are blank', () => {
    const result = validateConfig({
      ...fullyConfigured,
      apiBaseUrl: '',
      msalClientId: '',
    });
    expect(result.status).toBe('degraded');
    expect(result.missing.sort()).toEqual(['apiBaseUrl', 'msalClientId'].sort());
  });

  it('treats App Insights connection string as optional (does not appear in missing)', () => {
    const result = validateConfig({
      ...fullyConfigured,
      appInsightsConnectionString: '',
    });
    expect(result.status).toBe('ok');
  });

  it('reports every required key when nothing is set', () => {
    const result = validateConfig({
      apiBaseUrl: '',
      indexerRemoteUrl: '',
      msalClientId: '',
      msalAuthority: '',
      msalApiScope: '',
      appInsightsConnectionString: '',
    });
    expect(result.status).toBe('degraded');
    expect(result.missing.sort()).toEqual(
      ['apiBaseUrl', 'indexerRemoteUrl', 'msalAuthority', 'msalApiScope', 'msalClientId'].sort(),
    );
  });
});

describe('isAppInsightsConfigured', () => {
  it('returns true when the connection string is set', () => {
    expect(isAppInsightsConfigured(fullyConfigured)).toBe(true);
  });

  it('returns false when the connection string is empty', () => {
    expect(isAppInsightsConfigured({ ...fullyConfigured, appInsightsConnectionString: '' })).toBe(
      false,
    );
  });
});
