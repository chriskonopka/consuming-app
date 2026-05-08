/**
 * App shell — page chrome that hosts the indexer canvas plus the chat (slice 3)
 * and viewer (slice 4) panels (REQUIREMENTS.md §2.8).
 *
 * Owns:
 *   - Header bar (brand, theme toggle, chat toggle, user menu)
 *   - Main canvas hosting `<IndexerHost>` (slice 2) + chat panel as a sibling
 *     so chat can read `useActiveCollection`
 *   - `<ViewerProvider>` wraps the shell so chat (citation click), source
 *     list, and indexer-host (`document/selected`) all share one viewer state
 *   - Skip-to-main link (a11y)
 *   - Layout reducer state for chat-panel open/closed + chat/viewer widths.
 *     The viewer's "open" flag lives on the viewer reducer itself
 *     (data-model.md §2.5 — transient per session, never persisted).
 *   - Page-view telemetry
 */

import { ChatCircleText } from '@phosphor-icons/react';
import { useCallback } from 'react';

import {
  DEFAULT_CHAT_PANEL_WIDTH_PX,
  DEFAULT_VIEWER_PANEL_WIDTH_PX,
} from '@shared/types';

import { useTrackPageView } from '../telemetry/useTrackPageView';

import { ErrorBoundary } from '../components/ErrorBoundary';
import { IconButton } from '../components/IconButton';
import {
  CHAT_PANEL_MAX_PX,
  CHAT_PANEL_MIN_PX,
  ChatPanel,
} from '../features/chat';
import { IndexerHost } from '../features/indexer-host';
import {
  DocumentViewer,
  VIEWER_PANEL_MAX_PX,
  VIEWER_PANEL_MIN_PX,
  ViewerProvider,
  useViewer,
} from '../features/viewer';
import { UserMenu, useAuth } from '../auth';
import { useTheme } from '../theme';

import styles from './AppShell.module.scss';
import { useLayoutState } from './useLayoutState';

const clampChatWidth = (widthPx: number): number =>
  Math.min(Math.max(widthPx, CHAT_PANEL_MIN_PX), CHAT_PANEL_MAX_PX);

const clampViewerWidth = (widthPx: number): number =>
  Math.min(Math.max(widthPx, VIEWER_PANEL_MIN_PX), VIEWER_PANEL_MAX_PX);

const MAIN_CONTENT_ID = 'main-content';

const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      className={styles.themeToggle}
      aria-pressed={isDark}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? 'Dark' : 'Light'}
    </button>
  );
};

interface AppShellInnerProps {
  layoutState: ReturnType<typeof useLayoutState>['state'];
  layoutDispatch: ReturnType<typeof useLayoutState>['dispatch'];
}

/**
 * Inner shell — split from the public `<AppShell>` so it can consume
 * `useViewer()` (which requires being inside `<ViewerProvider>`).
 */
const AppShellInner = ({ layoutState, layoutDispatch }: AppShellInnerProps) => {
  useTrackPageView();
  const { state: authState } = useAuth();
  const viewer = useViewer();

  const toggleChat = useCallback(
    () => layoutDispatch({ type: 'TOGGLE_CHAT_PANEL' }),
    [layoutDispatch],
  );

  const closeChat = useCallback(
    () => {
      if (layoutState.chatPanel.open) {
        layoutDispatch({ type: 'TOGGLE_CHAT_PANEL' });
      }
    },
    [layoutDispatch, layoutState.chatPanel.open],
  );

  const resizeChat = useCallback(
    (widthPx: number) => layoutDispatch({ type: 'SET_CHAT_PANEL_WIDTH', widthPx }),
    [layoutDispatch],
  );

  const resizeViewer = useCallback(
    (widthPx: number) =>
      layoutDispatch({ type: 'SET_VIEWER_PANEL_WIDTH', widthPx }),
    [layoutDispatch],
  );

  const chatWidthPx = clampChatWidth(layoutState.chatPanel.widthPx || DEFAULT_CHAT_PANEL_WIDTH_PX);
  const viewerWidthPx = clampViewerWidth(
    layoutState.viewerPanel.widthPx || DEFAULT_VIEWER_PANEL_WIDTH_PX,
  );

  const viewerOpen = viewer.state.open !== null;

  return (
    <>
      <a href={`#${MAIN_CONTENT_ID}`} className={styles.skipLink}>
        Skip to main content
      </a>
      <div className={styles.shell}>
        <header className={styles.header}>
          <h1 className={styles.brand}>Ask your collections</h1>
          <div className={styles.actions}>
            <IconButton
              icon={ChatCircleText}
              ariaLabel={layoutState.chatPanel.open ? 'Close chat panel' : 'Open chat panel'}
              onClick={toggleChat}
              ariaPressed={layoutState.chatPanel.open}
              ariaControls="chat-panel"
              ariaExpanded={layoutState.chatPanel.open}
            />
            <ThemeToggle />
            {authState.status === 'authenticated' && <UserMenu />}
          </div>
        </header>
        <main id={MAIN_CONTENT_ID} className={styles.main} tabIndex={-1}>
          <IndexerHost>
            <ChatPanel
              open={layoutState.chatPanel.open}
              widthPx={chatWidthPx}
              onClose={closeChat}
              onResize={resizeChat}
            />
            <DocumentViewer
              open={viewerOpen}
              widthPx={viewerWidthPx}
              onResize={resizeViewer}
            />
          </IndexerHost>
        </main>
      </div>
    </>
  );
};

export const AppShell = () => {
  const { state: layoutState, dispatch: layoutDispatch } = useLayoutState();

  return (
    <ErrorBoundary>
      <ViewerProvider>
        <AppShellInner layoutState={layoutState} layoutDispatch={layoutDispatch} />
      </ViewerProvider>
    </ErrorBoundary>
  );
};
