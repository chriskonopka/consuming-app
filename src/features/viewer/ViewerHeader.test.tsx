jest.mock('../../auth/msalInstance');

const apiRaw = jest.fn();
jest.mock('../../hooks/useApiClient', () => ({
  useApiClient: () => ({
    get: jest.fn(),
    post: jest.fn(),
    del: jest.fn(),
    raw: apiRaw,
  }),
}));

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('exposes a download button that is disabled while metadata is loading', () => {
    render(
      <ViewerHeader
        metadata={null}
        documentId={null}
        totalPages={0}
        onClose={jest.fn()}
      />,
    );
    // When there is no documentId at all the button is disabled — clicking
    // would have nothing to download.
    const downloadButton = screen.getByRole('button', { name: /^Download/ });
    expect(downloadButton).toBeDisabled();
  });

  it('clicking download fetches /content with the documentId and triggers a save', async () => {
    apiRaw.mockReset();
    const bytes = new Uint8Array([1, 2, 3, 4]);
    apiRaw.mockResolvedValue(
      new Response(bytes.buffer, {
        status: 200,
        headers: { 'content-type': 'application/pdf' },
      }),
    );
    // jsdom's anchor.click() doesn't trigger a download; spy on the click
    // method to confirm the flow reached it. (Real download verification is
    // an E2E concern.)
    const anchorClick = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    const user = userEvent.setup();
    render(
      <ViewerHeader
        metadata={buildMetadata({ fileName: 'brief.pdf' })}
        documentId="doc-1"
        totalPages={3}
        onClose={jest.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Download brief.pdf' }));

    expect(apiRaw).toHaveBeenCalledWith('/documents/doc-1/content');
    expect(anchorClick).toHaveBeenCalledTimes(1);
    anchorClick.mockRestore();
  });

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
