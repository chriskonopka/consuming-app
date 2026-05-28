import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';

import type { Citation } from '@shared/types';

import { SourceList } from './SourceList';

const buildCitation = (overrides: Partial<Citation> = {}): Citation => ({
  marker: 1,
  page: 1,
  x: 10,
  y: 10,
  w: 50,
  h: 10,
  documentId: 'doc-file-a',
  fileName: 'file-a.pdf',
  ...overrides,
});

describe('SourceList', () => {
  it('renders nothing when citations are empty', () => {
    const { container } = render(<SourceList citations={[]} onOpen={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the singular toggle label when there is exactly one citation', () => {
    render(<SourceList citations={[buildCitation()]} onOpen={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'View 1 source' })).toBeInTheDocument();
  });

  it('collapses citations to one row per (document, page) — 4 citations on 3 distinct pages = 3 sources', async () => {
    // Multiple line-level citations on the same page of the same document are
    // different lines of one page, so the panel lists them as a single source
    // (with a passage count), not as duplicate rows. The inline [N] badges keep
    // per-line precision; the panel is a deduped index.
    const user = userEvent.setup();
    render(
      <SourceList
        citations={[
          buildCitation({ marker: 1, documentId: 'doc-a', fileName: 'a.pdf', page: 1 }),
          buildCitation({ marker: 2, documentId: 'doc-a', fileName: 'a.pdf', page: 3 }),
          buildCitation({ marker: 3, documentId: 'doc-a', fileName: 'a.pdf', page: 1 }),
          buildCitation({ marker: 4, documentId: 'doc-b', fileName: 'b.pdf', page: 2 }),
        ]}
        onOpen={jest.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'View 3 sources' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    // The twice-cited page surfaces a passage count and announces it.
    expect(screen.getByText('(2)')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'a.pdf, page 1, 2 cited passages' }),
    ).toBeInTheDocument();
  });

  it('orders source rows by the marker that first cites each (document, page), even when input is shuffled', async () => {
    const user = userEvent.setup();
    render(
      <SourceList
        citations={[
          buildCitation({ marker: 3, documentId: 'doc-c', fileName: 'c.pdf', page: 5 }),
          buildCitation({ marker: 1, documentId: 'doc-a', fileName: 'a.pdf', page: 1 }),
          buildCitation({ marker: 2, documentId: 'doc-b', fileName: 'b.pdf', page: 4 }),
        ]}
        onOpen={jest.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'View 3 sources' }));
    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('a.pdf');
    expect(rows[0]).toHaveTextContent('p1');
    expect(rows[1]).toHaveTextContent('b.pdf');
    expect(rows[1]).toHaveTextContent('p4');
    expect(rows[2]).toHaveTextContent('c.pdf');
    expect(rows[2]).toHaveTextContent('p5');
  });

  it('collapses multiple line citations on the same (document, page) into one row', async () => {
    // The CIT-1 fix: two distinct citations on the same page of the same
    // document (different bbox / different lines) are a single source row, not
    // two rows that look like duplicates.
    const user = userEvent.setup();
    render(
      <SourceList
        citations={[
          buildCitation({ marker: 1, documentId: 'doc-a', fileName: 'a.pdf', page: 7, y: 100 }),
          buildCitation({ marker: 2, documentId: 'doc-a', fileName: 'a.pdf', page: 7, y: 400 }),
        ]}
        onOpen={jest.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'View 1 source' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('(2)')).toBeInTheDocument();
  });

  it('keeps same-named documents apart when documentId differs (fileName is not the identity)', async () => {
    // Two genuinely different documents can share a display name across
    // DocumentSets. Identity is documentId, so they must not merge.
    const user = userEvent.setup();
    render(
      <SourceList
        citations={[
          buildCitation({ marker: 1, documentId: 'doc-a', fileName: 'dup.pdf', page: 1 }),
          buildCitation({ marker: 2, documentId: 'doc-b', fileName: 'dup.pdf', page: 1 }),
        ]}
        onOpen={jest.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'View 2 sources' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('falls back to fileName for identity when documentId is null (legacy citations)', async () => {
    const user = userEvent.setup();
    render(
      <SourceList
        citations={[
          buildCitation({ marker: 1, documentId: null, fileName: 'legacy.pdf', page: 1 }),
          buildCitation({ marker: 2, documentId: null, fileName: 'legacy.pdf', page: 1 }),
        ]}
        onOpen={jest.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'View 1 source' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('(2)')).toBeInTheDocument();
  });

  it('opens the viewer at each page row independently', async () => {
    const user = userEvent.setup();
    const onOpen = jest.fn();
    const second = buildCitation({ marker: 2, documentId: 'doc-a', fileName: 'a.pdf', page: 9 });
    render(
      <SourceList
        citations={[
          buildCitation({ marker: 1, documentId: 'doc-a', fileName: 'a.pdf', page: 5 }),
          second,
        ]}
        onOpen={onOpen}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'View 2 sources' }));
    await user.click(screen.getByRole('button', { name: /a\.pdf, page 9/ }));
    expect(onOpen).toHaveBeenCalledWith(second);
  });

  it('opens a collapsed row at the lowest-marker citation on that page', async () => {
    // When a page is cited on several lines, clicking the single row opens the
    // viewer at the first (lowest-marker) citation — the group representative.
    const user = userEvent.setup();
    const onOpen = jest.fn();
    const first = buildCitation({
      marker: 1,
      documentId: 'doc-a',
      fileName: 'a.pdf',
      page: 4,
      y: 100,
    });
    const later = buildCitation({
      marker: 5,
      documentId: 'doc-a',
      fileName: 'a.pdf',
      page: 4,
      y: 500,
    });
    render(<SourceList citations={[later, first]} onOpen={onOpen} />);
    await user.click(screen.getByRole('button', { name: 'View 1 source' }));
    await user.click(screen.getByRole('button', { name: /a\.pdf, page 4/ }));
    expect(onOpen).toHaveBeenCalledWith(first);
  });

  it('toggle button reports its expanded state via aria-expanded', async () => {
    const user = userEvent.setup();
    render(<SourceList citations={[buildCitation()]} onOpen={jest.fn()} />);
    const toggle = screen.getByRole('button', { name: 'View 1 source' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(screen.getByRole('button', { name: 'Hide sources' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('exposes the full filename in a title attribute so overflow-truncated names are still discoverable', async () => {
    const user = userEvent.setup();
    render(
      <SourceList
        citations={[
          buildCitation({
            fileName: 'a-very-long-filename-that-likely-truncates-on-screen.pdf',
          }),
        ]}
        onOpen={jest.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'View 1 source' }));
    const fileNameSpan = screen.getByText(
      'a-very-long-filename-that-likely-truncates-on-screen.pdf',
    );
    expect(fileNameSpan).toHaveAttribute(
      'title',
      'a-very-long-filename-that-likely-truncates-on-screen.pdf',
    );
  });

  it('has no axe violations when collapsed', async () => {
    const { container } = render(<SourceList citations={[buildCitation()]} onOpen={jest.fn()} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations when expanded', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <SourceList
        citations={[
          buildCitation({ marker: 1, documentId: 'doc-a', fileName: 'a.pdf', page: 1 }),
          buildCitation({ marker: 2, documentId: 'doc-b', fileName: 'b.pdf', page: 2 }),
        ]}
        onOpen={jest.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'View 2 sources' }));
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
