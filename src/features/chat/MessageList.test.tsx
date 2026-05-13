import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import type { ReactNode } from 'react';

import type { CitationData, IndexerHandle, LocalMessage } from '@shared/types';

// Import the provider directly (not via the barrel) so the test doesn't pull
// `DocumentViewer.tsx` and its msalInstance module-load dependency chain.
import { ViewerProvider } from '../viewer/ViewerContext';

import { MessageList } from './MessageList';

jest.mock('../indexer-host', () => ({
  useIndexerRef: () => ({
    current: {
      selectCollection: () => undefined,
      revealDocument: () => undefined,
    } satisfies IndexerHandle,
  }),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <ViewerProvider>{children}</ViewerProvider>
);

const messages: ReadonlyArray<LocalMessage> = [
  {
    id: 'm-1',
    role: 'user',
    content: 'What is the governing law?',
    timestamp: '2026-05-06T00:00:00Z',
    llmProvider: null,
    citations: [],
    status: 'committed',
  },
  {
    id: 'm-2',
    role: 'assistant',
    content: 'New York [cite:1] applies.',
    timestamp: '2026-05-06T00:00:01Z',
    llmProvider: 'Claude',
    citations: [
      { marker: 1, page: 4, x: 10, y: 10, w: 100, h: 20, documentId: 'doc-msa', fileName: 'msa.pdf' },
    ],
    status: 'committed',
  },
];

describe('MessageList', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = jest.fn();
  });

  it('renders empty state when no messages and not streaming', () => {
    render(
      <MessageList messages={[]} streaming={null} completed={null} emptyStateLabel="Ask anything" />,
      { wrapper },
    );
    expect(screen.getByText('Ask anything')).toBeInTheDocument();
  });

  it('renders user and assistant bubbles with citation marker', () => {
    render(
      <MessageList messages={messages} streaming={null} completed={null} emptyStateLabel="" />,
      { wrapper },
    );
    expect(screen.getByText('What is the governing law?')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Citation 1 — msa\.pdf, page 4/ }),
    ).toHaveTextContent('[1]');
  });

  it('renders the SourceList expander beneath assistant messages with citations', () => {
    render(
      <MessageList messages={messages} streaming={null} completed={null} emptyStateLabel="" />,
      { wrapper },
    );
    expect(screen.getByRole('button', { name: 'View 1 source' })).toBeInTheDocument();
  });

  it('renders the streaming assistant bubble at the tail', () => {
    const citation: CitationData = {
      marker: 1, page: 1, x: 10, y: 10, w: 100, h: 10, documentId: 'doc-x', fileName: 'x.pdf',
    };
    render(
      <MessageList
        messages={messages}
        streaming={{
          userMessageId: 'u',
          userMessageText: 'tell me about NY',
          assistantBuffer: 'New York [cite:1]…',
          citations: [citation],
          abortController: new AbortController(),
          phase: 'finalizing',
          phaseStartedAt: 0,
        }}
        completed={null}
        emptyStateLabel=""
      />,
      { wrapper },
    );
    // The streaming bubble is rendered via aria-live region. Citation marker present.
    expect(
      screen.getAllByRole('button', { name: /Citation 1 — x\.pdf, page 1/ }).length,
    ).toBeGreaterThan(0);
  });

  it('falls back to a strike-through marker when [cite:N] arrives without a matching citation', () => {
    const orphan: LocalMessage = {
      id: 'm-3',
      role: 'assistant',
      content: 'See [cite:9] for the clause.',
      timestamp: '2026-05-06T00:00:02Z',
      llmProvider: 'Claude',
      citations: [],
      status: 'committed',
    };
    render(<MessageList messages={[orphan]} streaming={null} completed={null} emptyStateLabel="" />, {
      wrapper,
    });
    expect(
      screen.getByRole('button', { name: /Citation 9 — Unverified/ }),
    ).toBeInTheDocument();
  });

  it('renders the completed snapshot tail when /history has not caught up', () => {
    // Post-STREAM_ENDED: history hasn't returned the persisted messages yet.
    // The reducer's `completed` snapshot should fill the gap so the user
    // keeps seeing what they sent + the assistant reply.
    render(
      <MessageList
        messages={[]}
        streaming={null}
        completed={{
          userMessageId: 'u',
          userMessageText: 'where is Cambridge?',
          assistantBuffer: 'Cambridge is in Massachusetts.',
          citations: [],
          completedAt: 0,
        }}
        emptyStateLabel="Ask anything"
      />,
      { wrapper },
    );
    expect(screen.getByText('where is Cambridge?')).toBeInTheDocument();
    expect(screen.getByText('Cambridge is in Massachusetts.')).toBeInTheDocument();
    // Empty-state label should NOT show — the completed snapshot counts as
    // non-empty content.
    expect(screen.queryByText('Ask anything')).toBeNull();
  });

  it('hides the completed snapshot once /history contains the same user message', () => {
    // History caught up — the snapshot would duplicate the user bubble.
    const persisted: ReadonlyArray<LocalMessage> = [
      {
        id: 'srv-1',
        role: 'user',
        content: 'where is Cambridge?',
        timestamp: '',
        llmProvider: null,
        citations: [],
        status: 'committed',
      },
      {
        id: 'srv-2',
        role: 'assistant',
        content: 'Cambridge is in Massachusetts.',
        timestamp: '',
        llmProvider: 'Claude',
        citations: [],
        status: 'committed',
      },
    ];
    render(
      <MessageList
        messages={persisted}
        streaming={null}
        completed={{
          userMessageId: 'u',
          userMessageText: 'where is Cambridge?',
          assistantBuffer: 'Cambridge is in Massachusetts.',
          citations: [],
          completedAt: 0,
        }}
        emptyStateLabel=""
      />,
      { wrapper },
    );
    // Only one bubble per role — the snapshot was deduped because the last
    // user message in history matches its userMessageText.
    expect(screen.getAllByText('where is Cambridge?')).toHaveLength(1);
    expect(screen.getAllByText('Cambridge is in Massachusetts.')).toHaveLength(1);
  });

  it('passes axe in empty and populated states', async () => {
    let view = render(
      <MessageList messages={[]} streaming={null} completed={null} emptyStateLabel="Empty" />,
      { wrapper },
    );
    expect(await axe(view.container)).toHaveNoViolations();
    view.unmount();
    view = render(
      <MessageList messages={messages} streaming={null} completed={null} emptyStateLabel="" />,
      { wrapper },
    );
    expect(await axe(view.container)).toHaveNoViolations();
  });
});
