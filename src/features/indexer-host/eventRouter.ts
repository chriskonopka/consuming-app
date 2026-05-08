/**
 * Routes `IndexerEvent`s emitted by `<IndexerApp>` to the rest of the app.
 *
 * Pure dispatcher: all five event types are handled (per
 * module-boundaries.md §2.3 — every event type MUST have a handler, even if
 * the handler is a no-op for the current slice). New event types added to the
 * locked host contract block review until a case is added here.
 *
 * Event handlers are passed in as a typed bag so the React-side wiring can
 * keep its callbacks/state out of this module. This file imports nothing
 * runtime; it's pure logic, testable without rendering.
 */

import type { IndexerEvent } from '@shared/types';

export interface IndexerEventHandlers {
  /** Switch to the activated collection (may be null = no active collection). */
  onCollectionActivated: (event: Extract<IndexerEvent, { type: 'collection/activated' }>) => void;
  /** No-op in v1 per slice-plan.md; placeholder so future slices have an attach point. */
  onCollectionListChanged: () => void;
  /** Open the document in the viewer (slice 4 wires the viewer; slice 2 stores the click). */
  onDocumentSelected: (event: Extract<IndexerEvent, { type: 'document/selected' }>) => void;
  /** Trigger MSAL refresh + bump remountKey to force-remount the indexer. */
  onAuthExpired: () => void;
  /** Forward to telemetry (`appInsights.trackException`). */
  onUnhandledError: (event: Extract<IndexerEvent, { type: 'error/unhandled' }>) => void;
}

export const routeIndexerEvent = (
  event: IndexerEvent,
  handlers: IndexerEventHandlers,
): void => {
  switch (event.type) {
    case 'collection/activated':
      handlers.onCollectionActivated(event);
      return;
    case 'collection/list-changed':
      handlers.onCollectionListChanged();
      return;
    case 'document/selected':
      handlers.onDocumentSelected(event);
      return;
    case 'auth/expired':
      handlers.onAuthExpired();
      return;
    case 'error/unhandled':
      handlers.onUnhandledError(event);
      return;
    default: {
      // Compile-time exhaustiveness guard: if a new IndexerEvent variant is
      // added upstream and no case here covers it, `event` will not narrow to
      // `never` and the assignment fails type-check. Per module-boundaries.md
      // §2.3 every event type MUST have a handler.
      const exhaustive: never = event;
      throw new Error(
        `Unhandled indexer event type: ${(exhaustive as { type: string }).type}`,
      );
    }
  }
};
