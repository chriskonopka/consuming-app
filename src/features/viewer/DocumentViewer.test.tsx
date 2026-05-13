import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { type ReactNode } from 'react';

import type { CitationRect, DocumentMetadataResponse } from '@shared/types';

// pdf.js module-level mock — the viewer's PDF loader awaits getDocument().promise
// and uses page.getViewport / render / getTextContent. The factory body must be
// self-contained because jest.mock is hoisted above the variable declarations
// that follow.
jest.mock('pdfjs-dist', () => {
  const renderTask = { promise: Promise.resolve(undefined), cancel: jest.fn() };
  const mockPage = {
    getViewport: ({ scale }: { scale: number }) => ({
      width: 800 * scale,
      height: 1000 * scale,
      scale,
      rotation: 0,
    }),
    render: jest.fn(() => renderTask),
    getTextContent: jest.fn(() => Promise.resolve({ items: [], styles: {} })),
  };
  const mockPdf = {
    numPages: 5,
    getPage: jest.fn(() => Promise.resolve(mockPage)),
    destroy: jest.fn(() => Promise.resolve()),
  };
  const getDocument = jest.fn(() => ({ promise: Promise.resolve(mockPdf) }));
  const TextLayer = jest.fn(() => ({
    render: jest.fn(() => Promise.resolve(undefined)),
  }));
  return {
    __esModule: true,
    GlobalWorkerOptions: { workerSrc: '' },
    getDocument,
    TextLayer,
    // Test-only handles for assertions / overrides per-test.
    __pdfjsTesting: { mockPdf, mockPage, getDocument },
  };
});

const apiGet = jest.fn();
const apiRaw = jest.fn();
jest.mock('../../hooks/useApiClient', () => ({
  useApiClient: () => ({
    get: apiGet,
    post: jest.fn(),
    del: jest.fn(),
    raw: apiRaw,
  }),
}));

const pdfjsTesting = (jest.requireMock('pdfjs-dist') as { __pdfjsTesting: { mockPdf: { numPages: number; getPage: jest.Mock }; mockPage: { render: jest.Mock; getTextContent: jest.Mock; getViewport: (...args: unknown[]) => unknown }; getDocument: jest.Mock } }).__pdfjsTesting;

import { DocumentViewer } from './DocumentViewer';
import { ViewerProvider, useViewer } from './ViewerContext';

const buildMetadata = (
  overrides: Partial<DocumentMetadataResponse> = {},
): DocumentMetadataResponse => ({
  documentId: 'master-agreement.pdf',
  documentSetId: 'set-1',
  batchId: 'b',
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

const HIGHLIGHT: CitationRect = {
  page: 2,
  x: 10,
  y: 20,
  w: 100,
  h: 12,
  fileName: 'master-agreement.pdf',
  marker: 1,
};

const buildClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

const Harness = ({
  children,
  open,
  documentId,
  page,
  highlight,
}: {
  children: ReactNode;
  open: boolean;
  documentId: string | null;
  page?: number;
  highlight?: CitationRect | null;
}) => {
  const Bridge = () => {
    const viewer = useViewer();
    if (open && documentId && viewer.state.open?.documentId !== documentId) {
      viewer.open(documentId, page ?? 1, highlight ?? null);
    }
    return null;
  };

  return (
    <QueryClientProvider client={buildClient()}>
      <ViewerProvider>
        <Bridge />
        {children}
      </ViewerProvider>
    </QueryClientProvider>
  );
};

beforeEach(() => {
  apiGet.mockReset();
  apiRaw.mockReset();
  apiGet.mockResolvedValue(buildMetadata());
  apiRaw.mockResolvedValue(
    new Response(new ArrayBuffer(8), {
      status: 200,
      headers: { 'content-type': 'application/pdf' },
    }),
  );
  pdfjsTesting.getDocument.mockClear();
  pdfjsTesting.mockPdf.getPage.mockClear();
  pdfjsTesting.mockPage.render.mockClear();
});

describe('DocumentViewer', () => {
  it('renders nothing when the panel is closed', () => {
    render(
      <Harness open={false} documentId={null}>
        <DocumentViewer open={false} widthPx={600} />
      </Harness>,
    );
    expect(screen.queryByRole('dialog', { name: 'Document viewer' })).toBeNull();
  });

  it('shows an empty state when the panel is open with no document', () => {
    render(
      <Harness open documentId={null}>
        <DocumentViewer open widthPx={600} />
      </Harness>,
    );
    expect(screen.getByRole('dialog', { name: 'Document viewer' })).toBeInTheDocument();
    expect(screen.getByText('No document open.')).toBeInTheDocument();
  });

  it('loads and renders a PDF for the open document', async () => {
    render(
      <Harness open documentId="master-agreement.pdf">
        <DocumentViewer open widthPx={600} />
      </Harness>,
    );
    await waitFor(() => expect(pdfjsTesting.getDocument).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'master-agreement.pdf' }),
      ).toBeInTheDocument(),
    );
    await waitFor(() => expect(screen.getByText('5 pages')).toBeInTheDocument());
  });

  it('shows an error banner when the PDF fetch fails with a non-404 status', async () => {
    apiRaw.mockResolvedValue(new Response('boom', { status: 500 }));
    render(
      <Harness open documentId="missing.pdf">
        <DocumentViewer open widthPx={600} />
      </Harness>,
    );
    await waitFor(() =>
      expect(
        screen.getByText(
          'Could not load this document. Try closing and reopening it.',
        ),
      ).toBeInTheDocument(),
    );
  });

  it('shows a "no longer available" banner instead of a generic error on 404', async () => {
    // Self-heal: 404 on /documents/{id}/content means the document was
    // deleted (admin action, tenant wipe). Surface a distinct notice rather
    // than the generic "try closing and reopening it" message.
    apiRaw.mockResolvedValue(new Response('not found', { status: 404 }));
    render(
      <Harness open documentId="deleted.pdf">
        <DocumentViewer open widthPx={600} />
      </Harness>,
    );
    await waitFor(() =>
      expect(
        screen.getByText(
          'This document is no longer available — it may have been removed.',
        ),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText('Document unavailable.')).toBeInTheDocument();
    expect(
      screen.queryByText('Could not load this document. Try closing and reopening it.'),
    ).toBeNull();
  });

  it('shows the "Locating citation" banner while a highlight is pending render', () => {
    render(
      <Harness open documentId="master-agreement.pdf" page={2} highlight={HIGHLIGHT}>
        <DocumentViewer open widthPx={600} />
      </Harness>,
    );
    expect(
      screen.getByText('Locating citation on page 2…'),
    ).toBeInTheDocument();
  });

  it('shows "Couldn\'t locate" when the drift guard rejects', async () => {
    // Mocked page natural size is 800x1000 (see pdfjs mock); the drift guard
    // rejects rectangles whose rendered height exceeds the page height. Pick
    // an h well above 1000 so the verdict is unambiguous regardless of the
    // viewer's fit-to-width scale.
    const tooTall: CitationRect = { ...HIGHLIGHT, h: 1500 };
    render(
      <Harness open documentId="master-agreement.pdf" page={2} highlight={tooTall}>
        <DocumentViewer open widthPx={600} />
      </Harness>,
    );
    await waitFor(() =>
      expect(
        screen.getByText("Couldn’t locate this quote on the page."),
      ).toBeInTheDocument(),
    );
  });

  it('PageDown advances the page when total pages permit', async () => {
    const user = userEvent.setup();
    render(
      <Harness open documentId="master-agreement.pdf">
        <DocumentViewer open widthPx={600} />
      </Harness>,
    );
    await waitFor(() => expect(screen.getByText('5 pages')).toBeInTheDocument());
    const input = screen.getByRole('spinbutton', { name: 'Go to page' });
    expect(input).toHaveValue(1);

    // Focus the body region — the keydown listener attaches there.
    const dialog = screen.getByRole('dialog', { name: 'Document viewer' });
    const body = dialog.querySelector('[tabindex="0"]') as HTMLElement;
    body.focus();
    await user.keyboard('{PageDown}');
    await waitFor(() => expect(input).toHaveValue(2));
    await user.keyboard('{PageUp}');
    await waitFor(() => expect(input).toHaveValue(1));
  });

  it('Close button dispatches close', async () => {
    const user = userEvent.setup();
    // Use a one-shot harness so the close action isn't undone by auto-reopen.
    const OneShotBridge = ({ documentId }: { documentId: string }) => {
      const viewer = useViewer();
      const opened = (
        OneShotBridge as unknown as { __opened?: boolean }
      ).__opened;
      if (!opened) {
        (OneShotBridge as unknown as { __opened: boolean }).__opened = true;
        viewer.open(documentId, 1, null);
      }
      return null;
    };
    render(
      <QueryClientProvider client={buildClient()}>
        <ViewerProvider>
          <OneShotBridge documentId="master-agreement.pdf" />
          <DocumentViewer open widthPx={600} />
        </ViewerProvider>
      </QueryClientProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Close document viewer' }));
    await waitFor(() =>
      expect(screen.getByText('No document open.')).toBeInTheDocument(),
    );
  });

  it('scales the rendered page to fit the viewer panel width', async () => {
    // widthPx=600 → fit = 600 (panel) - 24 (.body padding) - 20 (safety buffer) = 556
    // mock natural page width at scale=1 is 800; expected canvas.width = 556
    const { container } = render(
      <Harness open documentId="master-agreement.pdf">
        <DocumentViewer open widthPx={600} />
      </Harness>,
    );
    await waitFor(() => expect(pdfjsTesting.mockPage.render).toHaveBeenCalled());
    const canvas = container.querySelector('canvas');
    expect(canvas?.width).toBe(556);
  });

  it('clamps the fit width when the panel is unusually narrow', async () => {
    // widthPx=100 → fit would be 56, but the MIN_FIT_WIDTH_PX floor (120) wins.
    const { container } = render(
      <Harness open documentId="master-agreement.pdf">
        <DocumentViewer open widthPx={100} />
      </Harness>,
    );
    await waitFor(() => expect(pdfjsTesting.mockPage.render).toHaveBeenCalled());
    const canvas = container.querySelector('canvas');
    expect(canvas?.width).toBe(120);
  });

  it('has no axe violations in the rendered state', async () => {
    const { container } = render(
      <Harness open documentId="master-agreement.pdf">
        <DocumentViewer open widthPx={600} />
      </Harness>,
    );
    await waitFor(() => expect(screen.getByText('5 pages')).toBeInTheDocument());
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
