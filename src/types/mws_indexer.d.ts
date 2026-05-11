/**
 * Ambient declaration for the federated `mws_indexer` remote.
 *
 * The indexer is loaded at runtime via Module Federation (slice 2 wires
 * the actual ModuleFederationPlugin). Until then — and indeed at any time
 * the type-checker runs — TypeScript needs to know the shape of the
 * exposed modules.
 *
 * This file mirrors the locked surface from
 *   /Users/chris/Documents/indexer-frontend/reusable-indexer/shared/types/host-contract.ts
 *
 * Keep it in lock-step. Any change to the indexer's host contract must be
 * propagated here AND to docs/architecture/api-contracts.md AND to
 * shared/types/indexer-host.ts. The indexer project owns the contract;
 * this app cannot evolve it unilaterally.
 */

declare module 'mws_indexer/types' {
  import type { ApplicationInsights } from '@microsoft/applicationinsights-web';

  export type ThemeTokenKey =
    | 'color-navy'
    | 'color-blue'
    | 'color-teal'
    | 'color-magenta'
    | 'color-orange'
    | 'color-gold'
    | 'color-error'
    | 'color-success'
    | 'color-warning'
    | 'bg-page'
    | 'bg-surface'
    | 'bg-sidebar'
    | 'text-primary'
    | 'text-secondary'
    | 'accent-interactive'
    | 'icon-default'
    | 'border-light';

  type AccessRole = 'Owner' | 'Shared';

  export interface SelectionDocument {
    documentId: string;
    fileName: string;
  }

  export interface SelectionFolder {
    folderId: string;
    folderName: string;
    /** Slash-joined ancestor path emitted by the indexer for display. */
    path: string;
  }

  export type IndexerEvent =
    | { type: 'auth/expired' }
    | {
        type: 'collection/activated';
        documentSetId: string | null;
        accessRole: AccessRole | null;
      }
    | { type: 'collection/list-changed' }
    | {
        type: 'document/selected';
        documentSetId: string;
        documentId: string;
        folderId: string | null;
      }
    | {
        /**
         * Per indexer PR #3 (commit 3cf5603): authoritative chat-scope
         * selection. Both arrays are always present (never undefined).
         * Fires on every mutation (add, remove, select-all, clear) and
         * on collection switch (with empty arrays for the new id). Does
         * not fire on initial mount when documentSetId is null.
         */
        type: 'selection/changed';
        documentSetId: string;
        documents: SelectionDocument[];
        folders: SelectionFolder[];
      }
    | {
        type: 'error/unhandled';
        operationId: string | null;
        messageForLogs: string;
      };

  export interface IndexerHandle {
    selectCollection: (documentSetId: string | null) => void;
    revealDocument: (documentId: string) => void;
  }

  export interface IndexerInitialState {
    documentSetId?: string;
    folderId?: string;
    documentId?: string;
  }

  export interface IndexerAppProps {
    apiBaseUrl: string;
    getAccessToken: () => Promise<string>;
    appInsights?: ApplicationInsights;
    themeOverrides?: Partial<Record<ThemeTokenKey, string>>;
    initialTheme?: 'light' | 'dark';
    initialState?: IndexerInitialState;
    onEvent?: (event: IndexerEvent) => void;
  }
}

declare module 'mws_indexer/IndexerApp' {
  import type { ForwardRefExoticComponent, RefAttributes } from 'react';
  import type { IndexerAppProps, IndexerHandle } from 'mws_indexer/types';

  const IndexerApp: ForwardRefExoticComponent<IndexerAppProps & RefAttributes<IndexerHandle>>;
  export default IndexerApp;
}
