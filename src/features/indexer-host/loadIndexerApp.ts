/**
 * Resolves the `mws_indexer/IndexerApp` component for `React.lazy`.
 *
 * In production and dev (no stub flag), this calls `import('mws_indexer/IndexerApp')`
 * which the webpack ModuleFederationPlugin transforms into a runtime fetch of
 * `${INDEXER_REMOTE_URL}/remoteEntry.js`.
 *
 * In E2E builds (`MSAL_E2E_STUB === 'true'`), the gating expression folds to
 * `true` at compile time; Terser keeps the stub branch and drops the dynamic
 * federated import. This avoids needing a running indexer remote during
 * Playwright runs (same dead-code-elimination pattern as MSAL — slice 1).
 *
 * The function returns a promise of the React component so it composes with
 * `React.lazy()`.
 */

import type { ComponentType, Ref } from 'react';
import type { IndexerAppProps, IndexerHandle } from '@shared/types';

type IndexerAppComponent = ComponentType<IndexerAppProps & { ref?: Ref<IndexerHandle> }>;

const useStub = process.env.MSAL_E2E_STUB === 'true';

export const loadIndexerApp = async (): Promise<{ default: IndexerAppComponent }> => {
  if (useStub) {
    return import('./IndexerApp.e2eStub');
  }
  // Webpack rewrites this dynamic import into a federated remote fetch when
  // the ModuleFederationPlugin sees `mws_indexer` in `remotes`.
  const remote = await import('mws_indexer/IndexerApp');
  return { default: remote.default };
};
