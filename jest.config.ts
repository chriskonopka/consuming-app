import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'jsdom',
  testPathIgnorePatterns: [
    '/node_modules/',
    '/e2e/',
    // Agent-spawned worktrees are independent checkouts; never run their tests
    // from the main tree (would double-count + conflict with the canonical run).
    '/\\.claude/worktrees/',
  ],
  preset: 'ts-jest',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  moduleNameMapper: {
    '\\.module\\.(css|scss)$': '<rootDir>/src/__mocks__/styleMock.ts',
    '\\.(jpg|jpeg|png|gif|svg|webp|avif|ico|woff2?|ttf|eot)$':
      '<rootDir>/src/__mocks__/fileMock.ts',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    // The Module Federation runtime is a webpack-time concern. Jest never
    // sees the real `mws_indexer` remote — point the IndexerApp dynamic import
    // at the local E2E stub so any test that hits the federated import
    // resolves cleanly. (`mws_indexer/types` is type-only and erased at
    // transpile time, so it does not need a mapping.)
    '^mws_indexer/IndexerApp$': '<rootDir>/src/features/indexer-host/IndexerApp.e2eStub.tsx',
    // pdf.js worker — webpack emits the worker file as an asset and surfaces
    // its URL via the default import (see webpack.config.js). In jest we don't
    // run the worker; treat the import as a static string asset.
    '^pdfjs-dist/build/pdf\\.worker(\\.min)?\\.mjs$':
      '<rootDir>/src/__mocks__/fileMock.ts',
    // pdfjs-dist ships ESM-only, which ts-jest's CommonJS transform can't
    // load. Tests that just walk the viewer's module graph (AppShell render,
    // axe sweeps) get a minimal stub; viewer-specific tests override this
    // mapping with `jest.mock('pdfjs-dist', ...)` factories.
    '^pdfjs-dist$': '<rootDir>/src/__mocks__/pdfjs-dist.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],

  // Coverage
  //
  // Per docs/architecture/scaffold-notes.md §4: each slice progressively adds
  // its directory to coverage. Slice 1 covers: auth/, theme/, telemetry/,
  // app-shell/, hooks/usePersistedReducer, utils/idb, appInsights, components/
  // ErrorBoundary, health/, config/. Future slices remove their entries from
  // the exclusion list:
  //   - Slice 2: features/indexer-host/, hooks/useApiClient, hooks/useUrlState
  //   - Slice 3: features/chat/, components/(IconButton|LoadingSpinner|Panel|Pill|Splitter), hooks/(useAbortable|useDebouncedValue), utils/parseSse, utils/problemDetails
  //   - Slice 4: features/citations/, features/viewer/, components/Tooltip, utils/bytesToBlobUrl
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__mocks__/**',
    '!src/main.tsx', // entry point — covered by E2E, not unit tests
    '!src/bootstrap.tsx', // MF async boundary — entry-equivalent
    '!src/auth/msalInstance.e2eStub.ts', // E2E-only seam, exercised by Playwright not jest
    '!src/features/indexer-host/IndexerApp.e2eStub.tsx', // E2E-only seam (mirrors msalInstance.e2eStub treatment)
    // Image rendering lands in slice 5; the helper stays excluded until then.
    '!src/utils/bytesToBlobUrl.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'html', 'lcov'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};

export default config;
