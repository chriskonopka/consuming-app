jest.mock('../../auth/msalInstance');
jest.mock('../../config/env', () => ({
  config: {
    apiBaseUrl: 'https://api.test',
    indexerRemoteUrl: 'http://localhost:9998',
    msalClientId: 'cid',
    msalAuthority: 'auth',
    msalApiScope: 'scope',
    appInsightsConnectionString: '',
  },
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { useReducer, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

import type { IndexerHandle, IndexerHostState } from '@shared/types';

import { MsalAppProvider } from '../../auth/MsalAppProvider';
import { ChatScopeProvider } from '../chat-scope';
import { IndexerHostContextProvider } from '../indexer-host/IndexerHostContext';
import {
  buildInitialIndexerHostState,
  indexerHostReducer,
} from '../indexer-host/indexerHostReducer';
import { ViewerProvider } from '../viewer';

import { ChatPanel } from './ChatPanel';

const msalMock = jest.requireMock('../../auth/msalInstance');

interface ProviderOptions {
  documentSetId?: string | null;
}

const Providers = ({
  children,
  documentSetId = 'col-1',
}: { children: ReactNode } & ProviderOptions) => {
  const [state, dispatch] = useReducer(
    indexerHostReducer,
    { documentSetId: documentSetId ?? undefined },
    (input) => {
      const seeded: IndexerHostState = buildInitialIndexerHostState(input);
      if (documentSetId) {
        seeded.activeCollection = { documentSetId, accessRole: 'Owner' };
      }
      return seeded;
    },
  );
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const indexerRef = { current: null as IndexerHandle | null };
  return (
    <MemoryRouter initialEntries={[documentSetId ? `/c/${documentSetId}` : '/']}>
      <MsalAppProvider>
        <QueryClientProvider client={queryClient}>
          <ChatScopeProvider>
            <ViewerProvider>
              <IndexerHostContextProvider state={state} dispatch={dispatch}>
                {/* indexerRef is never read by chat directly in slice 3; assigned but unused. */}
                <input type="hidden" ref={() => indexerRef} />
                {children}
              </IndexerHostContextProvider>
            </ViewerProvider>
          </ChatScopeProvider>
        </QueryClientProvider>
      </MsalAppProvider>
    </MemoryRouter>
  );
};

const buildSseStream = (chunks: string[]): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  let pulled = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (pulled >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[pulled]));
      pulled += 1;
    },
  });
};

const sseResponse = (chunks: string[]): Response => {
  // Test-only response wrapping a ReadableStream — the shimmed Response in
  // setupTests doesn't support body, so we patch ad-hoc.
  const stream = buildSseStream(chunks);
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'text/event-stream' }),
    body: stream,
  } as unknown as Response;
};

const conversationListResponse = (existing: { id: string } | null) =>
  new Response(
    JSON.stringify({
      items: existing
        ? [{ conversationId: existing.id, title: '', messageCount: 0, lastMessageAt: null }]
        : [],
      totalCount: existing ? 1 : 0,
      page: 1,
      pageSize: 1,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

const historyResponse = (messages: unknown[]) =>
  new Response(
    JSON.stringify({ conversationId: 'c-1', totalMessages: messages.length, messages, etag: 'e' }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

describe('ChatPanel', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    msalMock.__resetMsalMock();
    msalMock.msalInstance.getActiveAccount.mockReturnValue({
      homeAccountId: 'h',
      username: 'u@e',
      name: 'U',
    });
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    Element.prototype.scrollIntoView = jest.fn();
  });

  it('shows the open-a-collection hint when no collection is active', async () => {
    render(
      <Providers documentSetId={null}>
        <ChatPanel open widthPx={400} onClose={() => undefined} />
      </Providers>,
    );
    expect(await screen.findByText('Open a collection to start chatting.')).toBeInTheDocument();
  });

  it('does not render anything when closed', () => {
    render(
      <Providers>
        <ChatPanel open={false} widthPx={400} onClose={() => undefined} />
      </Providers>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders empty conversation state on first open', async () => {
    fetchMock.mockResolvedValueOnce(conversationListResponse(null));
    render(
      <Providers>
        <ChatPanel open widthPx={400} onClose={() => undefined} />
      </Providers>,
    );
    expect(await screen.findByText(/Ask anything about this collection/i)).toBeInTheDocument();
  });

  it('streams tokens and citations on send (happy path)', async () => {
    fetchMock
      .mockResolvedValueOnce(conversationListResponse(null)) // conversations/list -> empty
      .mockResolvedValueOnce(
        // POST /conversations -> creates conv
        new Response(
          JSON.stringify({
            conversationId: 'c-1',
            documentSetId: 'col-1',
            userId: 'u',
            title: '',
            messageCount: 0,
            lastMessageAt: null,
            createdAt: '',
            updatedAt: '',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        sseResponse([
          'event: token\ndata: {"text":"Hello"}\n\n',
          'event: token\ndata: {"text":" world"}\n\n',
          'event: citation\ndata: {"marker":1,"page":2,"x":10,"y":10,"w":50,"h":10,"fileName":"src.pdf"}\n\n',
        ]),
      )
      .mockResolvedValueOnce(
        historyResponse([
          {
            id: 'srv-1',
            role: 'user',
            content: 'Q',
            timestamp: '',
            llmProvider: null,
            citations: [],
          },
          {
            id: 'srv-2',
            role: 'assistant',
            content: 'Hello world [cite:1]',
            timestamp: '',
            llmProvider: 'Claude',
            citations: [{ marker: 1, page: 2, x: 10, y: 10, w: 50, h: 10, documentId: 'doc-src', fileName: 'src.pdf' }],
          },
        ]),
      );

    const user = userEvent.setup();
    render(
      <Providers>
        <ChatPanel open widthPx={400} onClose={() => undefined} />
      </Providers>,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Q');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() => {
      const sendBody = JSON.parse(fetchMock.mock.calls[2][1].body);
      expect(sendBody).toEqual({ content: 'Q', llmProvider: 'Claude' });
    });

    await waitFor(() => {
      expect(screen.getAllByText(/Hello world/i).length).toBeGreaterThan(0);
    });
  });

  it('renders pre-stream ProblemDetails detail as inline notice', async () => {
    fetchMock
      .mockResolvedValueOnce(conversationListResponse({ id: 'c-9' })) // conv exists
      .mockResolvedValueOnce(historyResponse([])) // history empty
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            type: 'https://problems.api/llm-unavailable',
            title: 'LLM unavailable',
            status: 503,
            detail: 'AI service unavailable, try again',
          }),
          {
            status: 503,
            headers: { 'content-type': 'application/problem+json' },
          },
        ),
      );

    const user = userEvent.setup();
    render(
      <Providers>
        <ChatPanel open widthPx={400} onClose={() => undefined} />
      </Providers>,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Q');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByText('AI service unavailable, try again')).toBeInTheDocument();
  });

  it('shows mid-stream error event as a non-blocking notice', async () => {
    fetchMock
      .mockResolvedValueOnce(conversationListResponse({ id: 'c-9' }))
      .mockResolvedValueOnce(historyResponse([]))
      .mockResolvedValueOnce(
        sseResponse([
          'event: token\ndata: {"text":"Partial"}\n\n',
          'event: error\ndata: {"message":"Search service down"}\n\n',
        ]),
      );

    const user = userEvent.setup();
    render(
      <Providers>
        <ChatPanel open widthPx={400} onClose={() => undefined} />
      </Providers>,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Q');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByText('Search service down')).toBeInTheDocument();
  });

  it('rejects content above 64 KB without sending', async () => {
    fetchMock.mockResolvedValueOnce(conversationListResponse(null));
    const user = userEvent.setup();
    render(
      <Providers>
        <ChatPanel open widthPx={400} onClose={() => undefined} />
      </Providers>,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const textarea = screen.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement;
    // Bypass keystroke-by-keystroke typing for a 65 KB payload (slow, irrelevant).
    const big = 'a'.repeat(64 * 1024 + 1);
    fireEvent.change(textarea, { target: { value: big } });
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(
      await screen.findByText(/Message too long — keep under 64,000 characters\./),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1); // only the conversations/list call
  });

  it('passes axe in idle (empty) state', async () => {
    fetchMock.mockResolvedValueOnce(conversationListResponse(null));
    const { container } = render(
      <Providers>
        <ChatPanel open widthPx={400} onClose={() => undefined} />
      </Providers>,
    );
    await screen.findByText(/Ask anything about this collection/i);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('passes axe with history loaded', async () => {
    fetchMock.mockResolvedValueOnce(conversationListResponse({ id: 'c-9' })).mockResolvedValueOnce(
      historyResponse([
        {
          id: 'srv-1',
          role: 'user',
          content: 'Hi',
          timestamp: '',
          llmProvider: null,
          citations: [],
        },
        {
          id: 'srv-2',
          role: 'assistant',
          content: 'Hello',
          timestamp: '',
          llmProvider: 'Claude',
          citations: [],
        },
      ]),
    );
    const { container } = render(
      <Providers>
        <ChatPanel open widthPx={400} onClose={() => undefined} />
      </Providers>,
    );
    await screen.findByText('Hello');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('Clear button opens confirmation dialog and confirms a delete', async () => {
    fetchMock
      .mockResolvedValueOnce(conversationListResponse({ id: 'c-9' }))
      .mockResolvedValueOnce(
        historyResponse([
          {
            id: 'srv-2',
            role: 'assistant',
            content: 'Hello',
            timestamp: '',
            llmProvider: 'Claude',
            citations: [],
          },
        ]),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(conversationListResponse(null));

    const user = userEvent.setup();
    render(
      <Providers>
        <ChatPanel open widthPx={400} onClose={() => undefined} />
      </Providers>,
    );

    const clear = await screen.findByRole('button', { name: 'Clear' });
    await user.click(clear);
    const dialog = screen.getByRole('alertdialog', { name: 'Clear conversation?' });
    await user.click(within(dialog).getByRole('button', { name: 'Clear' }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([, init]) => (init as RequestInit | undefined)?.method === 'DELETE',
        ),
      ).toBe(true);
    });
  });
});
