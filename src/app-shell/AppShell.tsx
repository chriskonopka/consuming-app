/**
 * App shell — the page chrome that hosts the indexer canvas plus the chat
 * and viewer panels (REQUIREMENTS.md §2.8).
 *
 * Scaffold state: only renders <HealthPage /> as proof the stack boots end-to-end.
 * Slice 1 fills in the header bar, theme toggle, user menu, panel slots, and
 * routing. Slices 2–5 plug in IndexerHost, ChatPanel, and DocumentViewer.
 */

import { ErrorBoundary } from '../components/ErrorBoundary';
import { HealthPage } from '../health';

export const AppShell = () => {
  return (
    <ErrorBoundary>
      <HealthPage />
    </ErrorBoundary>
  );
};
