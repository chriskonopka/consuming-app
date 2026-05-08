import type { IndexerEvent } from '@shared/types';

import { routeIndexerEvent, type IndexerEventHandlers } from './eventRouter';

const buildHandlers = (): IndexerEventHandlers & {
  callLog: Array<keyof IndexerEventHandlers>;
} => {
  const callLog: Array<keyof IndexerEventHandlers> = [];
  return {
    callLog,
    onCollectionActivated: jest.fn(() => {
      callLog.push('onCollectionActivated');
    }),
    onCollectionListChanged: jest.fn(() => {
      callLog.push('onCollectionListChanged');
    }),
    onDocumentSelected: jest.fn(() => {
      callLog.push('onDocumentSelected');
    }),
    onAuthExpired: jest.fn(() => {
      callLog.push('onAuthExpired');
    }),
    onUnhandledError: jest.fn(() => {
      callLog.push('onUnhandledError');
    }),
  };
};

describe('routeIndexerEvent', () => {
  it('routes collection/activated to onCollectionActivated with the event payload', () => {
    const handlers = buildHandlers();
    const event: IndexerEvent = {
      type: 'collection/activated',
      documentSetId: 'set-1',
      accessRole: 'Shared',
    };
    routeIndexerEvent(event, handlers);
    expect(handlers.onCollectionActivated).toHaveBeenCalledWith(event);
    expect(handlers.callLog).toEqual(['onCollectionActivated']);
  });

  it('routes collection/list-changed without payload', () => {
    const handlers = buildHandlers();
    routeIndexerEvent({ type: 'collection/list-changed' }, handlers);
    expect(handlers.onCollectionListChanged).toHaveBeenCalledTimes(1);
    expect(handlers.onCollectionListChanged).toHaveBeenCalledWith();
  });

  it('routes document/selected with payload', () => {
    const handlers = buildHandlers();
    const event: IndexerEvent = {
      type: 'document/selected',
      documentSetId: 'set-1',
      documentId: 'doc-1',
      folderId: null,
    };
    routeIndexerEvent(event, handlers);
    expect(handlers.onDocumentSelected).toHaveBeenCalledWith(event);
  });

  it('routes auth/expired to onAuthExpired', () => {
    const handlers = buildHandlers();
    routeIndexerEvent({ type: 'auth/expired' }, handlers);
    expect(handlers.onAuthExpired).toHaveBeenCalledTimes(1);
  });

  it('routes error/unhandled with the operationId and messageForLogs payload', () => {
    const handlers = buildHandlers();
    const event: IndexerEvent = {
      type: 'error/unhandled',
      operationId: 'op-123',
      messageForLogs: 'render-fail-without-pii',
    };
    routeIndexerEvent(event, handlers);
    expect(handlers.onUnhandledError).toHaveBeenCalledWith(event);
  });

  it('handles a multi-event sequence preserving order', () => {
    const handlers = buildHandlers();
    routeIndexerEvent({ type: 'auth/expired' }, handlers);
    routeIndexerEvent(
      { type: 'collection/activated', documentSetId: 's', accessRole: 'Owner' },
      handlers,
    );
    routeIndexerEvent({ type: 'collection/list-changed' }, handlers);
    expect(handlers.callLog).toEqual([
      'onAuthExpired',
      'onCollectionActivated',
      'onCollectionListChanged',
    ]);
  });

  it('does not call any non-matching handler for a given event', () => {
    const handlers = buildHandlers();
    routeIndexerEvent(
      { type: 'collection/activated', documentSetId: null, accessRole: null },
      handlers,
    );
    expect(handlers.onCollectionActivated).toHaveBeenCalledTimes(1);
    expect(handlers.onCollectionListChanged).not.toHaveBeenCalled();
    expect(handlers.onDocumentSelected).not.toHaveBeenCalled();
    expect(handlers.onAuthExpired).not.toHaveBeenCalled();
    expect(handlers.onUnhandledError).not.toHaveBeenCalled();
  });
});
