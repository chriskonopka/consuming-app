import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';

import { ScopeIndicator } from './ScopeIndicator';

const apiMocks = {
  get: jest.fn(),
};

jest.mock('../../hooks/useApiClient', () => ({
  useApiClient: () => apiMocks,
}));

const renderWith = (
  ui: React.ReactElement,
  { resolvedFiles }: { resolvedFiles?: Record<string, string> } = {},
) => {
  apiMocks.get.mockImplementation(async (path: string) => {
    const documentId = decodeURIComponent(path.split('/').pop() ?? '');
    return {
      documentId,
      documentSetId: 'set-1',
      batchId: 'batch-1',
      folderId: null,
      fileName: resolvedFiles?.[documentId] ?? 'Document',
      fileType: 'Other',
      contentType: 'application/pdf',
      fileSizeBytes: 1024,
      status: 'Ready',
      chunkCount: 4,
      createdAt: '2026-05-11T00:00:00Z',
      updatedAt: '2026-05-11T00:00:00Z',
    };
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe('<ScopeIndicator>', () => {
  beforeEach(() => {
    apiMocks.get.mockReset();
  });

  it('renders nothing when both arrays are empty', () => {
    const { container } = renderWith(
      <ScopeIndicator
        state={{ documentIds: [], folderIds: [] }}
        onRemoveDocument={jest.fn()}
        onRemoveFolder={jest.fn()}
        onClearAll={jest.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders a chip per document and folder, with the total count', async () => {
    renderWith(
      <ScopeIndicator
        state={{ documentIds: ['doc-a', 'doc-b'], folderIds: ['folder-1'] }}
        onRemoveDocument={jest.fn()}
        onRemoveFolder={jest.fn()}
        onClearAll={jest.fn()}
      />,
      { resolvedFiles: { 'doc-a': 'Quarterly report.pdf', 'doc-b': 'Contract.pdf' } },
    );
    expect(screen.getByLabelText('Chat scope')).toBeInTheDocument();
    expect(screen.getByText('Scoped to 3')).toBeInTheDocument();
    expect(await screen.findByText('Quarterly report.pdf')).toBeInTheDocument();
    expect(await screen.findByText('Contract.pdf')).toBeInTheDocument();
    expect(screen.getByText('Folder 1')).toBeInTheDocument();
  });

  it('calls onRemoveDocument with the right id when × is clicked', async () => {
    const user = userEvent.setup();
    const onRemoveDocument = jest.fn();
    renderWith(
      <ScopeIndicator
        state={{ documentIds: ['doc-a'], folderIds: [] }}
        onRemoveDocument={onRemoveDocument}
        onRemoveFolder={jest.fn()}
        onClearAll={jest.fn()}
      />,
      { resolvedFiles: { 'doc-a': 'Quarterly report.pdf' } },
    );
    const removeButton = await screen.findByRole('button', {
      name: 'Remove Quarterly report.pdf from chat scope',
    });
    await user.click(removeButton);
    expect(onRemoveDocument).toHaveBeenCalledWith('doc-a');
  });

  it('calls onRemoveFolder for folder chips', async () => {
    const user = userEvent.setup();
    const onRemoveFolder = jest.fn();
    renderWith(
      <ScopeIndicator
        state={{ documentIds: [], folderIds: ['folder-x'] }}
        onRemoveDocument={jest.fn()}
        onRemoveFolder={onRemoveFolder}
        onClearAll={jest.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Remove Folder 1 from chat scope' }));
    expect(onRemoveFolder).toHaveBeenCalledWith('folder-x');
  });

  it('fires onClearAll from the Clear all button', async () => {
    const user = userEvent.setup();
    const onClearAll = jest.fn();
    renderWith(
      <ScopeIndicator
        state={{ documentIds: ['doc-a'], folderIds: ['folder-x'] }}
        onRemoveDocument={jest.fn()}
        onRemoveFolder={jest.fn()}
        onClearAll={onClearAll}
      />,
      { resolvedFiles: { 'doc-a': 'Quarterly report.pdf' } },
    );
    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(onClearAll).toHaveBeenCalled();
  });

  it('has no axe violations in the populated state', async () => {
    const { container } = renderWith(
      <ScopeIndicator
        state={{ documentIds: ['doc-a'], folderIds: ['folder-x'] }}
        onRemoveDocument={jest.fn()}
        onRemoveFolder={jest.fn()}
        onClearAll={jest.fn()}
      />,
      { resolvedFiles: { 'doc-a': 'Quarterly report.pdf' } },
    );
    await screen.findByText('Quarterly report.pdf');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
