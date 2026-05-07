/**
 * Telemetry module surface — see module-boundaries.md §2.10.
 *
 * The App Insights singleton lives at /src/appInsights.ts (template-provided
 * location preserved per shared-inventory.md). We re-export it here so the
 * canonical import for everything telemetry-related is `from '../telemetry'`.
 */

export { appInsights } from '../appInsights';
export { ErrorBoundary } from '../components/ErrorBoundary';
export { useTrackPageView } from './useTrackPageView';
