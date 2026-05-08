/**
 * MF async-boundary mount. Imported asynchronously by main.tsx.
 *
 * Slice 1 wires the full provider chain:
 *   <ErrorBoundary>            outermost — catches anything in init
 *     <MsalAppProvider>        MSAL singleton + initialization
 *       <BrowserRouter>        react-router-dom
 *         <ThemeProvider>      light/dark toggle context
 *           <AuthGate>         sign-in screen if unauthenticated
 *             <AppShell>       chrome + routes
 *
 * Slice 2 adds <ModuleFederationPlugin> to the webpack config and lazy-loads
 * the indexer remote inside <IndexerHost />. The async-boundary pattern in
 * main.tsx is already in place — slice 2 doesn't have to refactor entry.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { BrowserRouter } from 'react-router-dom';

import { AppShell } from './app-shell';
import { MsalAppProvider } from './auth/MsalAppProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeProvider } from './theme/ThemeProvider';
import './styles/global.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found. Ensure <div id="root"> exists in index.html.');
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <MsalAppProvider>
        <BrowserRouter>
          <ThemeProvider>
            <AppShell />
          </ThemeProvider>
        </BrowserRouter>
      </MsalAppProvider>
    </ErrorBoundary>
  </StrictMode>,
);
