/**
 * Scaffold health indicator. Renders the runtime status of the configured
 * env vars without leaking secret values. A green response here proves:
 *
 *   1. webpack built the bundle
 *   2. dev server (or static host) served it
 *   3. React mounted
 *   4. the env-var pipeline (DefinePlugin → src/config/env.ts) is wired
 *
 * In the slice plan this page is replaced/augmented by react-router-dom routes
 * in slice 1, but the scaffold mounts it directly inside <AppShell>.
 */

import { config, isAppInsightsConfigured, validateConfig } from '../config/env';
import styles from './HealthPage.module.scss';

const maskValue = (value: string): string => {
  if (!value) return '(not set)';
  if (value.length <= 8) return '***';
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
};

export const HealthPage = () => {
  const validation = validateConfig();
  const aiEnabled = isAppInsightsConfigured();
  const overallStatus: 'OK' | 'Degraded' = validation.status === 'ok' ? 'OK' : 'Degraded';

  return (
    <main className={styles.main} aria-labelledby="health-heading">
      <h1 id="health-heading" className={styles.title}>
        Consuming app — scaffold health
      </h1>
      <p className={styles.subtitle}>
        Status: <strong data-testid="health-status">{overallStatus}</strong>
      </p>

      <section aria-labelledby="config-heading" className={styles.section}>
        <h2 id="config-heading">Configuration</h2>
        <dl className={styles.dl}>
          <dt>API base URL</dt>
          <dd>{config.apiBaseUrl || '(not set — required)'}</dd>

          <dt>Indexer remote URL</dt>
          <dd>{config.indexerRemoteUrl || '(not set — required)'}</dd>

          <dt>MSAL client ID</dt>
          <dd>{maskValue(config.msalClientId)}</dd>

          <dt>MSAL authority</dt>
          <dd>{config.msalAuthority || '(not set — required)'}</dd>

          <dt>MSAL API scope</dt>
          <dd>{config.msalApiScope || '(not set — required)'}</dd>

          <dt>App Insights</dt>
          <dd>
            {aiEnabled
              ? `enabled (${maskValue(config.appInsightsConnectionString)})`
              : 'disabled (optional — telemetry will be skipped)'}
          </dd>
        </dl>
      </section>

      {validation.status === 'degraded' && (
        <section aria-labelledby="missing-heading" className={styles.warning}>
          <h2 id="missing-heading">Missing required configuration</h2>
          <ul>
            {validation.missing.map((key) => (
              <li key={key}>
                <code>{key}</code>
              </li>
            ))}
          </ul>
          <p>
            Set these env vars before the corresponding slice can function. See{' '}
            <code>webpack.config.js</code> DefinePlugin block for the wiring.
          </p>
        </section>
      )}

      <section aria-labelledby="scaffold-heading" className={styles.section}>
        <h2 id="scaffold-heading">What&apos;s scaffolded</h2>
        <p>
          This is a build-scaffold checkpoint. Feature implementations land in slices
          1–5 per <code>docs/architecture/slice-plan.md</code>. Module folders exist
          as placeholders.
        </p>
      </section>
    </main>
  );
};
