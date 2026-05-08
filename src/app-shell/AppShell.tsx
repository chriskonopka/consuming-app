/**
 * App shell — the page chrome that hosts the indexer canvas plus the chat
 * and viewer panels (REQUIREMENTS.md §2.8).
 *
 * Slice 1 state: auth-gated chrome. Routes:
 *   /                       — landing (renders <HealthPage />)
 *   /c/:documentSetId       — collection-scoped (placeholder until slice 2 mounts <IndexerHost />)
 *
 * Slices 2-4 fill in IndexerHost, ChatPanel, DocumentViewer.
 */

import { Route, Routes } from 'react-router-dom';

import { ErrorBoundary } from '../components/ErrorBoundary';
import { AuthGate } from '../auth/AuthGate';
import { HealthPage } from '../health';
import { useTrackPageView } from '../telemetry/useTrackPageView';

import { HeaderBar } from './HeaderBar';
import { CollectionPlaceholder } from './CollectionPlaceholder';
import styles from './AppShell.module.css';

export const AppShell = () => {
  useTrackPageView();

  return (
    <ErrorBoundary>
      <AuthGate>
        <div className={styles.shell}>
          <HeaderBar />
          <main className={styles.main} id="main">
            <Routes>
              <Route path="/" element={<HealthPage />} />
              <Route
                path="/c/:documentSetId"
                element={<CollectionPlaceholder />}
              />
              <Route path="*" element={<HealthPage />} />
            </Routes>
          </main>
        </div>
      </AuthGate>
    </ErrorBoundary>
  );
};
