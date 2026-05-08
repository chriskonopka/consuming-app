import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import type { DocumentMetadataResponse } from '@shared/types';

import { useDocumentMetadata } from './useDocumentMetadata';

const apiGet = jest.fn();
jest.mock('../../hooks/useApiClient', () => ({
  useApiClient: () => ({
    get: apiGet,
    post: jest.fn(),
    del: jest.fn(),
    raw: jest.fn(),
  }),
}));

const buildMetadata = (
  overrides: Partial<DocumentMetadataResponse> = {},
): DocumentMetadataResponse => ({
  documentId: 'doc-1',
  documentSetId: 'set-1',
  batchId: 'b',
  folderId: null,
  fileName: 'a.pdf',
  fileType: 'Other',
  contentType: 'application/pdf',
  fileSizeBytes: 0,
  status: 'Ready',
  chunkCount: 0,
  createdAt: '',
  updatedAt: '',
  ...overrides,
});

const buildClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

const wrap = (client: QueryClient) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };

describe('useDocumentMetadata', () => {
  beforeEach(() => {
    apiGet.mockReset();
  });

  it('returns null while loading and the response when ready', async () => {
    apiGet.mockResolvedValue(buildMetadata());
    const { result } = renderHook(() => useDocumentMetadata('doc-1'), {
      wrapper: wrap(buildClient()),
    });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data?.documentId).toBe('doc-1');
    expect(apiGet).toHaveBeenCalledWith('/documents/doc-1');
  });

  it('does not fetch when documentId is null', () => {
    renderHook(() => useDocumentMetadata(null), {
      wrapper: wrap(buildClient()),
    });
    expect(apiGet).not.toHaveBeenCalled();
  });

  it('reports isError when the API call fails', async () => {
    apiGet.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useDocumentMetadata('doc-1'), {
      wrapper: wrap(buildClient()),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeNull();
  });
});
