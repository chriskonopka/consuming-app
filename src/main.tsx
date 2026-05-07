/**
 * Synchronous entry. Defers actual app code via an async import so that
 * Module Federation has a chance to resolve shared singletons (react,
 * react-dom) before any application module evaluates.
 *
 * See module-boundaries.md §1 and webpack.config.js. Slice 2 adds
 * ModuleFederationPlugin; the async-boundary pattern is already in place
 * here so slice 2 doesn't have to refactor entry.
 */

import('./bootstrap').catch((error: unknown) => {
  // eslint-disable-next-line no-console -- bootstrap failure must surface; App Insights isn't initialised yet at this layer
  console.error('Bootstrap failed:', error);
  const root = document.getElementById('root');
  if (root) {
    root.textContent = 'The app failed to start. Refresh to retry.';
  }
});
