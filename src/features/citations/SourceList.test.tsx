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
    render(
      <SourceList
        citations={[buildCitation({ marker: 1, page: 1 })]}
        onOpen={jest.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'View 1 source' })).toBeInTheDocument();
  });

  it('counts citations (markers), not unique files — 4 citations across 2 files = 4 sources', async () => {
    // Per the source-panel spec: one row per marker. Earlier versions
    // counted unique fileNames here, which collapsed multiple distinct
    // citation rectangles into a single row and made the panel order
    // disagree with the inline marker order.
    const user = userEvent.setup();
    render(
      <SourceList
        citations={[
          buildCitation({ marker: 1, fileName: 'a.pdf', page: 1 }),
          buildCitation({ marker: 2, fileName: 'a.pdf', page: 3 }),
          buildCitation({ marker: 3, fileName: 'a.pdf', page: 1 }),
          buildCitation({ marker: 4, fileName: 'b.pdf', page: 2 }),
        ]}
        onOpen={jest.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'View 4 sources' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'View 4 sources' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });

  it('renders one row per marker ordered ascending, even when input is shuffled', async () => {
    const user = userEvent.setup();
    render(
      <SourceList
        citations={[
          buildCitation({ marker: 3, fileName: 'c.pdf', page: 5 }),
          buildCitation({ marker: 1, fileName: 'a.pdf', page: 1 }),
          buildCitation({ marker: 2, fileName: 'b.pdf', page: 4 }),
        ]}
        onOpen={jest.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'View 3 sources' }));
    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('[1]');
    expect(rows[0]).toHaveTextContent('a.pdf');
    expect(rows[0]).toHaveTextContent('p1');
    expect(rows[1]).toHaveTextContent('[2]');
    expect(rows[1]).toHaveTextContent('b.pdf');
    expect(rows[2]).toHaveTextContent('[3]');
    expect(rows[2]).toHaveTextContent('c.pdf');
  });

  it('renders two rows when two markers point at the same (file, page) but different bbox', async () => {
    // Two distinct citations on the same page of the same document must
    // surface as two rows — they target different lines of the page.
    const user = userEvent.setup();
    render(
      <SourceList
        citations={[
          buildCitation({ marker: 1, fileName: 'a.pdf', page: 7, y: 100 }),
          buildCitation({ marker: 2, fileName: 'a.pdf', page: 7, y: 400 }),
        ]}
        onOpen={jest.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'View 2 sources' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('opens the viewer at the exact citation clicked, not the first cited page of the file', async () => {
    // Earlier the row click handed back the file's *first* cited citation;
    // now each row hands back its own citation so the inline marker and the
    // panel row open the same target.
    const user = userEvent.setup();
    const onOpen = jest.fn();
    const second = buildCitation({ marker: 2, fileName: 'a.pdf', page: 9 });
    render(
      <SourceList
        citations={[buildCitation({ marker: 1, fileName: 'a.pdf', page: 5 }), second]}
        onOpen={onOpen}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'View 2 sources' }));
    await user.click(screen.getByRole('button', { name: /Citation 2 — a\.pdf, page 9/ }));
    expect(onOpen).toHaveBeenCalledWith(second);
  });

  it('toggle button reports its expanded state via aria-expanded', async () => {
    const user = userEvent.setup();
    render(
      <SourceList
        citations={[buildCitation({ fileName: 'a.pdf', page: 1 })]}
        onOpen={jest.fn()}
      />,
    );
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
          buildCitation({ marker: 1, fileName: 'a-very-long-filename-that-likely-truncates-on-screen.pdf' }),
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
    const { container } = render(
      <SourceList
        citations={[buildCitation({ fileName: 'a.pdf', page: 1 })]}
        onOpen={jest.fn()}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations when expanded', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <SourceList
        citations={[
          buildCitation({ marker: 1, fileName: 'a.pdf', page: 1 }),
          buildCitation({ marker: 2, fileName: 'b.pdf', page: 2 }),
        ]}
        onOpen={jest.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'View 2 sources' }));
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
