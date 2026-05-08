import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'jsdom',
  testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
  preset: 'ts-jest',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  moduleNameMapper: {
    '\\.module\\.(css|scss)$': '<rootDir>/src/__mocks__/styleMock.ts',
    '\\.(jpg|jpeg|png|gif|svg|webp|avif|ico|woff2?|ttf|eot)$':
      '<rootDir>/src/__mocks__/fileMock.ts',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    // Federation remote — resolved at runtime via webpack ModuleFederationPlugin.
    // Jest tests use a local stand-in that mimics the contract surface.
    '^mws_indexer/IndexerApp$': '<rootDir>/src/__mocks__/mws_indexer.tsx',
    '^mws_indexer/types$': '<rootDir>/src/__mocks__/mws_indexer.tsx',
  },
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],

  // Coverage
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__mocks__/**',
    '!src/main.tsx', // entry point — covered by E2E, not unit tests
    '!src/bootstrap.tsx', // MF async boundary — entry-equivalent
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
