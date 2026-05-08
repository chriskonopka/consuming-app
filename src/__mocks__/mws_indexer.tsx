/**
 * Jest mock for the federated `mws_indexer/IndexerApp` and `mws_indexer/types`
 * modules. Resolved via jest.config.ts moduleNameMapper.
 *
 * Renders a tiny placeholder so tests can assert on its presence and verify
 * the host's onEvent wiring without booting the real federation runtime.
 */

import { forwardRef, useImperativeHandle, type Ref } from 'react';

interface IndexerAppProps {
  apiBaseUrl: string;
  getAccessToken: () => Promise<string>;
  appInsights?: unknown;
  themeOverrides?: Record<string, string>;
  initialTheme?: 'light' | 'dark';
  initialState?: { documentSetId?: string; folderId?: string; documentId?: string };
  onEvent?: (event: unknown) => void;
}

interface IndexerHandle {
  selectCollection: (documentSetId: string | null) => void;
  revealDocument: (documentId: string) => void;
}

const IndexerApp = forwardRef<IndexerHandle, IndexerAppProps>((props, ref: Ref<IndexerHandle>) => {
  useImperativeHandle(ref, () => ({
    selectCollection: () => {},
    revealDocument: () => {},
  }));
  return (
    <div data-testid="mock-indexer-app" data-api-base-url={props.apiBaseUrl}>
      Mock IndexerApp (federated remote stand-in)
    </div>
  );
});

IndexerApp.displayName = 'MockIndexerApp';

export default IndexerApp;
