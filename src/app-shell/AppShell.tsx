/**
 * App shell — the page chrome that hosts the indexer canvas plus the chat
 * and viewer panels (REQUIREMENTS.md §2.8).
 *
 * Slice 3 state: chat panel slot wired. Slices 4-5 add the viewer + sharing.
 *   /                       — IndexerHost without a deep-linked collection
 *   /c/:documentSetId       — IndexerHost mounted, deep-linked
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
              <Route path="/" element={<IndexerHost />} />
              <Route path="/c/:documentSetId" element={<IndexerHost />} />
              <Route path="*" element={<HealthPage />} />
            </Routes>
          </main>
          <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
        </div>
      </AuthGate>
    </ErrorBoundary>
  );
};
