/**
 * Jest mock for the federated `mws_indexer/IndexerApp` and `mws_indexer/types`
 * modules. Resolved via jest.config.ts moduleNameMapper.
 *
 * Renders a tiny placeholder so tests can assert on its presence and verify
 * the host's onEvent wiring without booting the real federation runtime.
 *
 * `__testHooks` lets tests drive the mock: emit events to the host's
 * onEvent prop, and assert on imperative-ref calls. Tests should call
 * `__testHooks.reset()` in beforeEach to clear state between tests.
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

let capturedOnEvent: ((event: unknown) => void) | undefined;
const selectCollectionSpy = jest.fn();
const revealDocumentSpy = jest.fn();

export const __testHooks = {
  /** Invoke the host's onEvent prop with a synthesized IndexerEvent. */
  emit: (event: unknown): void => {
    if (capturedOnEvent) capturedOnEvent(event);
  },
  /** Spy on the imperative ref's selectCollection calls. */
  selectCollectionSpy,
  /** Spy on the imperative ref's revealDocument calls. */
  revealDocumentSpy,
  /** Clear all captured state — call from beforeEach. */
  reset: (): void => {
    capturedOnEvent = undefined;
    selectCollectionSpy.mockClear();
    revealDocumentSpy.mockClear();
  },
};

const IndexerApp = forwardRef<IndexerHandle, IndexerAppProps>((props, ref: Ref<IndexerHandle>) => {
  capturedOnEvent = props.onEvent;
  useImperativeHandle(ref, () => ({
    selectCollection: selectCollectionSpy,
    revealDocument: revealDocumentSpy,
  }));
  return (
    <div data-testid="mock-indexer-app" data-api-base-url={props.apiBaseUrl}>
      Mock IndexerApp (federated remote stand-in)
    </div>
  );
});

IndexerApp.displayName = 'MockIndexerApp';

export default IndexerApp;
