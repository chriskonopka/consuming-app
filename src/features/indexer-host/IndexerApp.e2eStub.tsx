/**
 * Playwright stub for `mws_indexer/IndexerApp`. Used only when the build is
 * invoked with `MSAL_E2E_STUB=true` (set by `playwright.config.ts`'s
 * webServer.env). Production builds dead-code-eliminate this branch — see
 * `loadIndexerApp.ts` for the gating expression.
 *
 * Mirrors the locked surface (`IndexerAppProps` + `IndexerHandle`) closely
 * enough to drive the slice-2 critical-path E2E (deep-link → mount → URL
 * round-trip → back-button restores). It does NOT implement folder/file
 * browsing — slice 5's full critical-path E2E depends on the real indexer.
 */

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

import type { IndexerAppProps, IndexerEvent, IndexerHandle } from '@shared/types';

const STUB_COLLECTIONS: ReadonlyArray<{ id: string; name: string }> = [
  { id: 'stub-collection-1', name: 'Stub collection 1' },
  { id: 'stub-collection-2', name: 'Stub collection 2' },
];

const STUB_DOCUMENT_ID = 'stub-doc-1';

const IndexerAppStub = forwardRef<IndexerHandle, IndexerAppProps>(
  ({ initialState, onEvent }, ref) => {
    const [activeId, setActiveId] = useState<string | null>(initialState?.documentSetId ?? null);

    useImperativeHandle(
      ref,
      (): IndexerHandle => ({
        selectCollection: (documentSetId) => {
          setActiveId(documentSetId);
          const event: IndexerEvent = {
            type: 'collection/activated',
            documentSetId,
            accessRole: documentSetId ? 'Owner' : null,
          };
          onEvent?.(event);
        },
        revealDocument: () => {
          // Best-effort — stub doesn't render a file list, so this is a no-op.
        },
      }),
      [onEvent],
    );

    // On mount, mirror the deep-link state back to the host as a
    // collection/activated event so the host's reducer sees the same value.
    useEffect(() => {
      if (initialState?.documentSetId) {
        const event: IndexerEvent = {
          type: 'collection/activated',
          documentSetId: initialState.documentSetId,
          accessRole: 'Owner',
        };
        onEvent?.(event);
      }
      // initialState is captured once on mount on purpose — re-running on
      // every prop change would re-emit the activation event.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleClick = (id: string): void => {
      setActiveId(id);
      onEvent?.({ type: 'collection/activated', documentSetId: id, accessRole: 'Owner' });
    };

    const handleSelectDocument = (): void => {
      if (!activeId) return;
      onEvent?.({
        type: 'document/selected',
        documentSetId: activeId,
        documentId: STUB_DOCUMENT_ID,
        folderId: null,
      });
    };

    const handleAuthExpired = (): void => {
      onEvent?.({ type: 'auth/expired' });
    };

    const handleUnhandledError = (): void => {
      onEvent?.({
        type: 'error/unhandled',
        operationId: 'stub-op',
        messageForLogs: 'stub_unhandled_error',
      });
    };

    const handleListChanged = (): void => {
      onEvent?.({ type: 'collection/list-changed' });
    };

    return (
      <div data-testid="indexer-stub">
        <h2>Indexer (stub)</h2>
        <p>Active collection: {activeId ?? 'none'}</p>
        <ul>
          {STUB_COLLECTIONS.map((collection) => (
            <li key={collection.id}>
              <button type="button" onClick={() => handleClick(collection.id)}>
                {collection.name}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={handleSelectDocument} disabled={!activeId}>
          Open stub document
        </button>
        {/*
         * Test-only event triggers — used by jest specs to drive the host's
         * event router without reaching into internals. Visible in the E2E
         * build too but the E2E suite never clicks them, so behaviour stays
         * deterministic. A toast-style hidden control would be preferable but
         * web-styling.md and web-accessibility.md both prefer plain buttons
         * with labels over visually-hidden test affordances.
         */}
        <button type="button" onClick={handleAuthExpired}>
          Trigger auth/expired
        </button>
        <button type="button" onClick={handleUnhandledError}>
          Trigger error/unhandled
        </button>
        <button type="button" onClick={handleListChanged}>
          Trigger collection/list-changed
        </button>
      </div>
    );
  },
);

IndexerAppStub.displayName = 'IndexerAppStub';

export default IndexerAppStub;
