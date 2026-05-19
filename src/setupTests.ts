import '@testing-library/jest-dom';
import { toHaveNoViolations } from 'jest-axe';
import { randomUUID } from 'crypto';
import { serialize, deserialize } from 'v8';
import { IDBFactory } from 'fake-indexeddb';
import { TextEncoder, TextDecoder } from 'util';
import {
  ReadableStream as NodeReadableStream,
  WritableStream as NodeWritableStream,
  TransformStream as NodeTransformStream,
} from 'node:stream/web';

// jsdom 20 / Jest 29 do not expose TextEncoder / TextDecoder on the globals.
// react-router-dom@7 references them at module load. Polyfill from Node's util.
if (typeof globalThis.TextEncoder === 'undefined') {
  // @ts-expect-error -- assigning Node's util types to a globalThis slot Jest's jsdom env leaves unset
  globalThis.TextEncoder = TextEncoder;
}
if (typeof globalThis.TextDecoder === 'undefined') {
  // @ts-expect-error -- as above for TextDecoder
  globalThis.TextDecoder = TextDecoder;
}

// jsdom 20 does not implement PointerEvent. The Splitter component uses
// onPointerDown / onPointerMove / onPointerUp; tests that exercise drag need
// the constructor (fireEvent.pointerDown synthesises a PointerEvent). Subclass
// MouseEvent and copy over the pointer-specific fields the handler reads.
if (typeof globalThis.PointerEvent === 'undefined') {
  class PointerEventShim extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? '';
    }
  }
  // @ts-expect-error -- structural shim for jsdom; tests exercise pointerId / pointerType / clientX / clientY only
  globalThis.PointerEvent = PointerEventShim;
}
// pointer-capture API is also missing in jsdom — tests assert on the resize
// callback, not capture state, so a no-op is sufficient.
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.hasPointerCapture = () => true;
  Element.prototype.releasePointerCapture = () => undefined;
}

// jsdom's `<canvas>` returns null from getContext('2d'); pdf.js (and any
// other consumer) treats null as a hard render failure. Slice 4 mocks pdf.js
// itself so the context is never actually drawn to — but the viewer code
// still null-checks before calling render. Return an empty object so the
// null-check passes; the real drawing path is exercised end-to-end by
// Playwright, not jest.
if (typeof HTMLCanvasElement !== 'undefined') {
  // @ts-expect-error -- structural shim for jsdom; no rendering happens in unit tests
  HTMLCanvasElement.prototype.getContext = () => ({});
}

// jsdom 20 does not expose ReadableStream / WritableStream / TransformStream.
// chat's SSE client (slice 3) uses ReadableStream; tests that build mock SSE
// responses need the constructor available globally. Use Node 18+'s built-in.
if (typeof globalThis.ReadableStream === 'undefined') {
  // @ts-expect-error -- shim Node's stream/web ReadableStream onto the jsdom global
  globalThis.ReadableStream = NodeReadableStream;
}
if (typeof globalThis.WritableStream === 'undefined') {
  // @ts-expect-error -- shim Node's stream/web WritableStream
  globalThis.WritableStream = NodeWritableStream;
}
if (typeof globalThis.TransformStream === 'undefined') {
  // @ts-expect-error -- shim Node's stream/web TransformStream
  globalThis.TransformStream = NodeTransformStream;
}

// jsdom 20 does not expose the Fetch API constructors (Response/Headers).
// Slice 2 onwards exercises useApiClient + problemDetails which need them to
// construct fake responses in unit tests. A real fetch implementation is NOT
// needed (every fetch call in tests is mocked), so we ship a minimal shim
// that supports only the surface our tests use:
//   new Response(body, { status, headers }) → .status / .ok / .headers / .json() / .text() / .clone()
//   new Headers(init)                       → .get / .set / .has
// Loading undici / whatwg-fetch instead would pull in agents and timers that
// keep the Node event loop alive after tests finish (causes Jest worker leak
// warnings — see commit history).
if (typeof globalThis.Headers === 'undefined') {
  class HeadersShim {
    private map = new Map<string, string>();
    constructor(init?: HeadersInit | Record<string, string>) {
      if (!init) return;
      if (init instanceof HeadersShim) {
        init.map.forEach((value, key) => this.map.set(key, value));
      } else if (Array.isArray(init)) {
        for (const [key, value] of init) this.set(key, value);
      } else {
        for (const [key, value] of Object.entries(init as Record<string, string>)) {
          this.set(key, value);
        }
      }
    }
    get(name: string): string | null {
      return this.map.get(name.toLowerCase()) ?? null;
    }
    set(name: string, value: string): void {
      this.map.set(name.toLowerCase(), value);
    }
    has(name: string): boolean {
      return this.map.has(name.toLowerCase());
    }
    forEach(callback: (value: string, key: string) => void): void {
      this.map.forEach((value, key) => callback(value, key));
    }
  }
  // @ts-expect-error -- structural shim for jsdom
  globalThis.Headers = HeadersShim;
}
if (typeof globalThis.Response === 'undefined') {
  class ResponseShim {
    readonly status: number;
    readonly headers: Headers;
    private readonly bodyText: string;
    private readonly bodyBytes: ArrayBuffer | null;
    constructor(body?: BodyInit | null, init?: ResponseInit) {
      this.status = init?.status ?? 200;
      this.headers = new Headers(init?.headers ?? {});
      if (body == null) {
        this.bodyText = '';
        this.bodyBytes = null;
      } else if (typeof body === 'string') {
        this.bodyText = body;
        this.bodyBytes = null;
      } else if (body instanceof ArrayBuffer) {
        this.bodyBytes = body;
        this.bodyText = '';
      } else if (ArrayBuffer.isView(body)) {
        // Slice creates a fresh ArrayBuffer that won't be detached by the
        // caller — safe to read multiple times.
        this.bodyBytes = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;
        this.bodyText = '';
      } else {
        this.bodyText = String(body);
        this.bodyBytes = null;
      }
    }
    get ok(): boolean {
      return this.status >= 200 && this.status < 300;
    }
    async json(): Promise<unknown> {
      return JSON.parse(this.bodyText);
    }
    async text(): Promise<string> {
      return this.bodyText;
    }
    async arrayBuffer(): Promise<ArrayBuffer> {
      if (this.bodyBytes) return this.bodyBytes;
      // Encode the text body as UTF-8 bytes so callers like pdf.js can consume.
      return new TextEncoder().encode(this.bodyText).buffer as ArrayBuffer;
    }
    clone(): ResponseShim {
      const copy = new ResponseShim(this.bodyBytes ?? this.bodyText, {
        status: this.status,
        headers: {},
      });
      this.headers.forEach((value, key) => copy.headers.set(key, value));
      return copy;
    }
  }
  // @ts-expect-error -- structural shim for jsdom; tests assert on the surface only
  globalThis.Response = ResponseShim;
}

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

// jsdom does not expose URL.createObjectURL / revokeObjectURL. The viewer's
// image renderer (slice 5) relies on object URLs to feed authenticated image
// bytes into an `<img src=…>`. Provide a minimal counter-based shim so
// component tests don't need to reimplement these per-file. Tests that need
// to assert on the calls override these with `jest.spyOn(URL, 'createObjectURL')`.
if (typeof URL.createObjectURL === 'undefined') {
  let counter = 0;
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: (blob: Blob | MediaSource) => {
      counter += 1;
      const size = blob instanceof Blob ? blob.size : 0;
      return `blob:jsdom-shim/${counter}-${size}`;
    },
  });
}
if (typeof URL.revokeObjectURL === 'undefined') {
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: () => undefined,
  });
}

// jsdom does not implement IndexedDB. Replace it with fake-indexeddb before
// each test and reset it to a fresh instance so tests are fully isolated.
beforeEach(() => {
  global.indexedDB = new IDBFactory();
});
