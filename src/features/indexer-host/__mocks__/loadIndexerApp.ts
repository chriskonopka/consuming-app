/**
 * Manual jest mock for `loadIndexerApp`. Activated via `jest.mock('./loadIndexerApp')`
 * in tests that need to render `<IndexerHost>` without going through the
 * Module Federation runtime (which requires webpack's plugin to rewrite the
 * dynamic import — not present under jest).
 *
 * Returns the e2e stub component so tests get a deterministic surface that
 * mirrors the locked `IndexerAppProps` + `IndexerHandle` shapes.
 */

import IndexerAppStub from '../IndexerApp.e2eStub';

export const loadIndexerApp = async () => ({ default: IndexerAppStub });
