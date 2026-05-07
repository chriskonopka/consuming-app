import '@testing-library/jest-dom';
import { toHaveNoViolations } from 'jest-axe';
import { randomUUID } from 'crypto';
import { serialize, deserialize } from 'v8';
import { IDBFactory } from 'fake-indexeddb';

// Register the jest-axe matcher globally so every component test can call
// `expect(results).toHaveNoViolations()` without re-registering per file.
expect.extend(toHaveNoViolations);

// jsdom does not expose crypto.randomUUID — polyfill using Node's built-in crypto
Object.defineProperty(global, 'crypto', {
  value: { randomUUID },
  configurable: true,
});

// jsdom does not implement window.matchMedia — provide a no-op stub so components
// that read prefers-color-scheme (e.g. useTheme) work in the test environment.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// jsdom 20 does not expose structuredClone on the window global. fake-indexeddb
// v6 requires it to deep-clone stored values. Use Node's v8 serialize/deserialize
// for a correct structured-clone implementation in the test environment.
global.structuredClone = <T>(value: T): T => deserialize(serialize(value)) as T;

// jsdom does not implement IndexedDB. Replace it with fake-indexeddb before
// each test and reset it to a fresh instance so tests are fully isolated.
beforeEach(() => {
  global.indexedDB = new IDBFactory();
});
