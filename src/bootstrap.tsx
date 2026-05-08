/**
 * MF async-boundary mount. Imported asynchronously by main.tsx so Module
 * Federation can resolve shared singletons before any application module
 * evaluates (slice 2 adds the actual MF plugin; the boundary exists now
 * so slice 2 doesn't refactor entry).
 *
 * Provider chain (outer → inner):
 *   MsalAppProvider     — MSAL + AuthContext (REQUIREMENTS.md §3)
 *     ThemeProvider     — DOM data-theme + localStorage (§6.2)
 *       BrowserRouter   — react-router for /, /c/:id, /health (§2.7)
 *         <Routes>      — AuthGate-wrapped shell on app routes; HealthPage at /health
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { AppShell } from './app-shell';
import { AuthGate, MsalAppProvider } from './auth';
import { HealthPage } from './health';
import { ThemeProvider } from './theme';

import './styles/global.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found. Ensure <div id="root"> exists in index.html.');
}

createRoot(rootElement).render(
  <StrictMode>
    <MsalAppProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/health" element={<HealthPage />} />
              {/*
               * Catch-all so the AppShell stays mounted across collection
               * navigations (`/`, `/c/:id`, future routes). The collection id
               * is read via `useMatch('/c/:documentSetId')` inside
               * `useUrlState` — using a separate `<Route path="/c/:id">` would
               * remount the shell on each navigation and unmount the lazy-
               * loaded indexer chunk.
               */}
              <Route
                path="*"
                element={
                  <AuthGate>
                    <AppShell />
                  </AuthGate>
                }
              />
            </Routes>
          </BrowserRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </MsalAppProvider>
  </StrictMode>,
);
