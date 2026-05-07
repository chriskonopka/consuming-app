/**
 * Env-var loader and validator. Reads values exposed by webpack.DefinePlugin
 * at build time (see webpack.config.js). Exposes a typed `Config` object and a
 * `validateConfig()` function that returns which required keys are missing.
 *
 * Secrets do not belong here — only public configuration (clientId, authority,
 * scope, public URLs, write-only ingestion keys). See web-error-logging.md.
 */

export interface Config {
  apiBaseUrl: string;
  indexerRemoteUrl: string;
  msalClientId: string;
  msalAuthority: string;
  msalApiScope: string;
  appInsightsConnectionString: string;
}

export const config: Config = {
  apiBaseUrl: process.env.API_BASE_URL,
  indexerRemoteUrl: process.env.INDEXER_REMOTE_URL,
  msalClientId: process.env.MSAL_CLIENT_ID,
  msalAuthority: process.env.MSAL_AUTHORITY,
  msalApiScope: process.env.MSAL_API_SCOPE,
  appInsightsConnectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
};

/**
 * Required keys for the app to be production-ready. App Insights is optional
 * (we degrade gracefully without telemetry) but every other key is mandatory
 * because the app cannot function without auth or without knowing where the
 * API and indexer remote live.
 */
const REQUIRED_KEYS = [
  'apiBaseUrl',
  'indexerRemoteUrl',
  'msalClientId',
  'msalAuthority',
  'msalApiScope',
] as const satisfies ReadonlyArray<keyof Config>;

export type ValidationResult =
  | { status: 'ok'; missing: never[] }
  | { status: 'degraded'; missing: Array<keyof Config> };

export const validateConfig = (cfg: Config = config): ValidationResult => {
  const missing = REQUIRED_KEYS.filter((key) => !cfg[key]);
  if (missing.length === 0) return { status: 'ok', missing: [] };
  return { status: 'degraded', missing };
};

/**
 * Boolean — App Insights is optional but we surface its status separately so
 * the health page can show "telemetry disabled" without flagging the whole
 * deploy as degraded.
 */
export const isAppInsightsConfigured = (cfg: Config = config): boolean =>
  Boolean(cfg.appInsightsConnectionString);
