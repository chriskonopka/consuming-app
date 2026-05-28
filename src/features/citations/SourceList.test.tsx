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

  it('shows the singular toggle label when there is one cited document', () => {
    render(<SourceList citations={[buildCitation()]} onOpen={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'View 1 source' })).toBeInTheDocument();
  });

  it('groups citations by document — 4 citations across 2 documents = 2 sources', async () => {
    // The panel lists one entry per cited document (file name shown once) with a
    // passage count, not one row per citation. Per-passage navigation is restored
    // by expanding a document (see the expand test below).
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
    await user.click(screen.getByRole('button', { name: 'View 2 sources' }));
    expect(screen.getByRole('button', { name: 'a.pdf, 3 passages' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'b.pdf, 1 passage' })).toBeInTheDocument();
    // Each document header surfaces its passage count.
    expect(screen.getByText('(3)')).toBeInTheDocument();
    expect(screen.getByText('(1)')).toBeInTheDocument();
  });

  it('reveals a document’s passages as [N] links only after the document row is expanded', async () => {
    const user = userEvent.setup();
    render(
      <SourceList
        citations={[
          buildCitation({ marker: 1, documentId: 'doc-a', fileName: 'a.pdf', page: 1 }),
          buildCitation({ marker: 2, documentId: 'doc-a', fileName: 'a.pdf', page: 3 }),
        ]}
        onOpen={jest.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'View 1 source' }));
    // Collapsed document: its passages are not in the DOM yet.
    expect(screen.queryByRole('button', { name: /Open citation 1/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'a.pdf, 2 passages' }));
    expect(screen.getByRole('button', { name: 'Open citation 1 on page 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open citation 2 on page 3' })).toBeInTheDocument();
  });

  it('opens the viewer at the exact citation when a passage link is clicked', async () => {
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
    await user.click(screen.getByRole('button', { name: 'View 1 source' }));
    await user.click(screen.getByRole('button', { name: 'a.pdf, 2 passages' }));
    await user.click(screen.getByRole('button', { name: 'Open citation 2 on page 9' }));
    expect(onOpen).toHaveBeenCalledWith(second);
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
    expect(screen.getAllByRole('button', { name: 'dup.pdf, 1 passage' })).toHaveLength(2);
  });

  it('falls back to fileName for identity when documentId is null (legacy citations)', async () => {
    const user = userEvent.setup();
    render(
      <SourceList
        citations={[
          buildCitation({ marker: 1, documentId: null, fileName: 'legacy.pdf', page: 1 }),
          buildCitation({ marker: 2, documentId: null, fileName: 'legacy.pdf', page: 2 }),
        ]}
        onOpen={jest.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'View 1 source' }));
    expect(screen.getByRole('button', { name: 'legacy.pdf, 2 passages' })).toBeInTheDocument();
  });

  it('orders documents and their passages by marker, even when input is shuffled', async () => {
    const user = userEvent.setup();
    render(
      <SourceList
        citations={[
          buildCitation({ marker: 3, documentId: 'doc-b', fileName: 'b.pdf', page: 5 }),
          buildCitation({ marker: 1, documentId: 'doc-a', fileName: 'a.pdf', page: 1 }),
          buildCitation({ marker: 2, documentId: 'doc-a', fileName: 'a.pdf', page: 4 }),
        ]}
        onOpen={jest.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'View 2 sources' }));
    // doc-a (first cited at marker 1) precedes doc-b (first cited at marker 3).
    const docRows = screen.getAllByRole('button', { name: /passages?$/ });
    expect(docRows[0]).toHaveAccessibleName('a.pdf, 2 passages');
    expect(docRows[1]).toHaveAccessibleName('b.pdf, 1 passage');
    // Within doc-a, passages read in marker order.
    await user.click(docRows[0]);
    const passages = screen.getAllByRole('button', { name: /Open citation/ });
    expect(passages[0]).toHaveAccessibleName('Open citation 1 on page 1');
    expect(passages[1]).toHaveAccessibleName('Open citation 2 on page 4');
  });

  it('document row reports and toggles its expanded state via aria-expanded', async () => {
    const user = userEvent.setup();
    render(<SourceList citations={[buildCitation({ fileName: 'a.pdf' })]} onOpen={jest.fn()} />);
    await user.click(screen.getByRole('button', { name: 'View 1 source' }));
    const docRow = screen.getByRole('button', { name: 'a.pdf, 1 passage' });
    expect(docRow).toHaveAttribute('aria-expanded', 'false');
    await user.click(docRow);
    expect(docRow).toHaveAttribute('aria-expanded', 'true');
    // Collapsing again hides the passages.
    await user.click(docRow);
    expect(screen.queryByRole('button', { name: /Open citation/ })).not.toBeInTheDocument();
  });

  it('top-level toggle reports its expanded state via aria-expanded', async () => {
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

  it('has no axe violations when the panel is expanded (documents collapsed)', async () => {
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

  it('has no axe violations when a document is expanded to its passages', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <SourceList
        citations={[
          buildCitation({ marker: 1, documentId: 'doc-a', fileName: 'a.pdf', page: 1 }),
          buildCitation({ marker: 2, documentId: 'doc-a', fileName: 'a.pdf', page: 3 }),
        ]}
        onOpen={jest.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'View 1 source' }));
    await user.click(screen.getByRole('button', { name: 'a.pdf, 2 passages' }));
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
