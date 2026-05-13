import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';

import type { DocumentMetadataResponse } from '@shared/types';

import { ViewerHeader } from './ViewerHeader';

const buildMetadata = (
  overrides: Partial<DocumentMetadataResponse> = {},
): DocumentMetadataResponse => ({
  documentId: 'doc-1',
  documentSetId: 'set-1',
  batchId: 'batch-1',
  folderId: null,
  fileName: 'master-agreement.pdf',
  fileType: 'Contract',
  contentType: 'application/pdf',
  fileSizeBytes: 1024,
  status: 'Ready',
  chunkCount: 1,
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
  ...overrides,
});

describe('ViewerHeader', () => {
  it('falls back to the documentId while metadata is loading', () => {
    render(
      <ViewerHeader
        metadata={null}
        documentId="placeholder.pdf"
        totalPages={0}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'placeholder.pdf' })).toBeInTheDocument();
  });

  it('renders the metadata fileName, fileType pill, and page count', () => {
    render(
      <ViewerHeader
        metadata={buildMetadata()}
        documentId="placeholder.pdf"
        totalPages={12}
        onClose={jest.fn()}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'master-agreement.pdf' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('File type: Contract')).toBeInTheDocument();
    expect(screen.getByText('12 pages')).toBeInTheDocument();
  });

  it('renders singular page label when totalPages is 1', () => {
    render(
      <ViewerHeader
        metadata={buildMetadata()}
        documentId="x.pdf"
        totalPages={1}
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText('1 page')).toBeInTheDocument();
  });

  it('omits the page meta when totalPages is 0', () => {
    render(
      <ViewerHeader
        metadata={buildMetadata()}
        documentId="x.pdf"
        totalPages={0}
        onClose={jest.fn()}
      />,
    );
    expect(screen.queryByText(/page$/i)).toBeNull();
  });

  it('the close button calls onClose', async () => {
    const onClose = jest.fn();
    render(
      <ViewerHeader
        metadata={null}
        documentId="x.pdf"
        totalPages={0}
        onClose={onClose}
      />,
    );
    screen.getByRole('button', { name: 'Close document viewer' }).click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each(['Financial', 'Contract', 'Regulatory', 'Other'] as const)(
    'maps fileType %s to a recognisable pill tone',
    (fileType) => {
      render(
        <ViewerHeader
          metadata={buildMetadata({ fileType })}
          documentId="x.pdf"
          totalPages={1}
          onClose={jest.fn()}
        />,
      );
      expect(screen.getByLabelText(`File type: ${fileType}`)).toBeInTheDocument();
    },
  );

  it('has no axe violations', async () => {
    const { container } = render(
      <ViewerHeader
        metadata={buildMetadata()}
        documentId="x.pdf"
        totalPages={3}
        onClose={jest.fn()}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
