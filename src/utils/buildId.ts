/**
 * Build identifier baked into the bundle at compile time via
 * `webpack.DefinePlugin` (see webpack.config.js). The same value is emitted
 * to `dist/version.json` so the runtime can detect a deploy by polling that
 * file and comparing — see `useReloadOnNewVersion`.
 *
 * In jest the constant is undefined (no DefinePlugin pass), so this module
 * provides a deterministic test fallback. Tests that need to assert on the
 * value override the export with `jest.mock('@/utils/buildId', …)`.
 */

// `typeof` guard for non-webpack environments (jest, SSR). DefinePlugin
// replaces `__BUILD_ID__` with a string literal in the bundle; outside that
// pass the symbol is undefined and the `typeof` check is statically false.
export const BUILD_ID: string =
  typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'unknown';
