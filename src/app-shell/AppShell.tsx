/**
 * App shell — the page chrome that hosts the indexer canvas plus the chat
 * and viewer panels (REQUIREMENTS.md §2.8).
 *
 * IndexerHost is mounted on a single wildcard route so that navigating
 * between `/` and `/c/:documentSetId` (or between two collections) is a
 * URL-parameter change, not a route swap. A route swap would unmount
 * IndexerHost — destroying indexerRef, the indexer's QueryClient, and any
 * in-flight requests — which violates §2.6 (the imperative ref must persist
 * across URL-driven collection switches).
 *
 * Slice 3 state: chat panel slot wired. Slices 4-5 add the viewer + sharing.
 */

import { useState } from 'react';

import { Route, Routes } from 'react-router-dom';

import { ErrorBoundary } from '../components/ErrorBoundary';
import { AuthGate } from '../auth/AuthGate';
import { ChatPanel } from '../features/chat';
import { IndexerHost } from '../features/indexer-host';
import { HealthPage } from '../health';
import { useTrackPageView } from '../telemetry/useTrackPageView';

import { HeaderBar } from './HeaderBar';
import styles from './AppShell.module.css';

export const AppShell = () => {
  useTrackPageView();
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <ErrorBoundary>
      <AuthGate>
        <div className={styles.shell}>
          <HeaderBar
            chatOpen={chatOpen}
            onToggleChat={() => setChatOpen((prev) => !prev)}
          />
          <main className={styles.main} id="main">
            <Routes>
              <Route path="/health" element={<HealthPage />} />
              <Route path="*" element={<IndexerHost />} />
            </Routes>
          </main>
          <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
        </div>
      </AuthGate>
    </ErrorBoundary>
  );
};
