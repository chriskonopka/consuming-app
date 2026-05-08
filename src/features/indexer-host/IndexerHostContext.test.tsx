import { render } from '@testing-library/react';

import {
  useActiveCollection,
  useIndexerRef,
} from './IndexerHostContext';

const ProbeCollection = () => {
  useActiveCollection();
  return <p>probe</p>;
};

const ProbeRef = () => {
  useIndexerRef();
  return <p>probe</p>;
};

describe('IndexerHostContext consumer hooks', () => {
  // Suppress the React error boundary log noise — the throw IS the assertion.
  let originalError: typeof console.error;
  beforeEach(() => {
    // eslint-disable-next-line no-console -- captured to suppress React's expected throw output
    originalError = console.error;
    // eslint-disable-next-line no-console -- intentional override during expected-throw assertions
    console.error = jest.fn();
  });
  afterEach(() => {
    // eslint-disable-next-line no-console -- restoring the original handler
    console.error = originalError;
  });

  it('useActiveCollection throws when called outside <IndexerHost>', () => {
    expect(() => render(<ProbeCollection />)).toThrow(
      /must be called inside <IndexerHost>/,
    );
  });

  it('useIndexerRef throws when called outside <IndexerHost>', () => {
    expect(() => render(<ProbeRef />)).toThrow(/must be called inside <IndexerHost>/);
  });
});
