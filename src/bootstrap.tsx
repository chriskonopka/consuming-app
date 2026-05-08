/**
 * MF async-boundary mount. Imported asynchronously by main.tsx.
 *
 * Provider chain (outermost-to-innermost):
 *   <ErrorBoundary>            catches anything in init
 *     <MsalAppProvider>        MSAL singleton + initialization
 *       <BrowserRouter>        react-router-dom
 *         <QueryClientProvider> TanStack Query — slice 3 added
 *           <ThemeProvider>    light/dark toggle context
 *             <AuthGate>       sign-in screen if unauthenticated
 *               <AppShell>     chrome + routes
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

import { AppShell } from './app-shell';
import { MsalAppProvider } from './auth/MsalAppProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeProvider } from './theme/ThemeProvider';
import './styles/global.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep things crisp for chat-driven UX; the hooks override per-query
      // staleTime / gcTime where stronger guarantees are needed.
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found. Ensure <div id="root"> exists in index.html.');
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <MsalAppProvider>
        <BrowserRouter>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <AppShell />
            </ThemeProvider>
          </QueryClientProvider>
        </BrowserRouter>
      </MsalAppProvider>
    </ErrorBoundary>
  </StrictMode>,
);
