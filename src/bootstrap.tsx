/**
 * MF async-boundary mount. Imported asynchronously by main.tsx.
 * Slices 1+ wrap <AppShell /> with provider chains (MsalProvider,
 * QueryClientProvider, ThemeProvider, BrowserRouter) here.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { AppShell } from './app-shell';
import './styles/global.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found. Ensure <div id="root"> exists in index.html.');
}

createRoot(rootElement).render(
  <StrictMode>
    <AppShell />
  </StrictMode>,
);
