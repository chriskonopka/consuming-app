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

  it('shows the source count in singular when only one unique source', () => {
    render(
      <SourceList
        citations={[buildCitation({ marker: 1, page: 1 })]}
        onOpen={jest.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'View 1 source' })).toBeInTheDocument();
  });

  it('shows the source count in plural when multiple unique sources', () => {
    render(
      <SourceList
        citations={[
          buildCitation({ fileName: 'a.pdf', page: 1 }),
          buildCitation({ fileName: 'b.pdf', page: 1, marker: 2 }),
        ]}
        onOpen={jest.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'View 2 sources' })).toBeInTheDocument();
  });

  it('expands to show grouped sources with deduped pages', async () => {
    const user = userEvent.setup();
    render(
      <SourceList
        citations={[
          buildCitation({ fileName: 'a.pdf', page: 1, marker: 1 }),
          buildCitation({ fileName: 'a.pdf', page: 3, marker: 2 }),
          buildCitation({ fileName: 'a.pdf', page: 1, marker: 3 }),
          buildCitation({ fileName: 'b.pdf', page: 2, marker: 4 }),
        ]}
        onOpen={jest.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'View 2 sources' }));
    expect(screen.getByRole('list', { name: 'Cited sources' })).toBeInTheDocument();
    expect(screen.getByText('a.pdf')).toBeInTheDocument();
    expect(screen.getByText('Pages 1, 3')).toBeInTheDocument();
    expect(screen.getByText('b.pdf')).toBeInTheDocument();
    expect(screen.getByText('Page 2')).toBeInTheDocument();
  });

  it('opens the viewer at the first cited page of the clicked source', async () => {
    const user = userEvent.setup();
    const onOpen = jest.fn();
    const firstA = buildCitation({ fileName: 'a.pdf', page: 5, marker: 1 });
    render(
      <SourceList
        citations={[firstA, buildCitation({ fileName: 'a.pdf', page: 9, marker: 2 })]}
        onOpen={onOpen}
      />,
    );
    await user.click(screen.getByRole('button', { name: /View .* source/ }));
    await user.click(screen.getByRole('button', { name: /a\.pdf/ }));
    expect(onOpen).toHaveBeenCalledWith(firstA);
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
        citations={[buildCitation({ fileName: 'a.pdf', page: 1 })]}
        onOpen={jest.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'View 1 source' }));
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
