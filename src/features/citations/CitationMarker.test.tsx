import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';

import type { Citation } from '@shared/types';

import { CitationMarker } from './CitationMarker';

const VERIFIED: Citation = {
  marker: 1,
  page: 7,
  x: 10,
  y: 20,
  w: 100,
  h: 12,
  fileName: 'master-agreement.pdf',
};

const MISSING_COORDS: Citation = {
  marker: 2,
  page: 7,
  x: 0,
  y: 0,
  w: 0,
  h: 0,
  fileName: 'no-coords.pdf',
};

describe('CitationMarker', () => {
  it('renders the [N] superscript', () => {
    render(<CitationMarker citation={VERIFIED} onOpen={jest.fn()} />);
    expect(screen.getByRole('button')).toHaveTextContent('[1]');
  });

  it('shows "{fileName}, page {N}" tooltip for verified citations', () => {
    render(<CitationMarker citation={VERIFIED} onOpen={jest.fn()} />);
    expect(screen.getByRole('tooltip')).toHaveTextContent('master-agreement.pdf, page 7');
  });

  it('renders strike-through and "Unverified" tooltip when coordinates missing', () => {
    render(<CitationMarker citation={MISSING_COORDS} onOpen={jest.fn()} />);
    expect(screen.getByRole('button').className).toMatch(/unverified/);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Unverified — coordinates missing');
  });

  it('calls onOpen with the full citation when clicked', async () => {
    const onOpen = jest.fn();
    const user = userEvent.setup();
    render(<CitationMarker citation={VERIFIED} onOpen={onOpen} />);
    await user.click(screen.getByRole('button'));
    expect(onOpen).toHaveBeenCalledWith(VERIFIED);
  });

  it('exposes a meaningful aria-label that includes the marker number', () => {
    render(<CitationMarker citation={VERIFIED} onOpen={jest.fn()} />);
    expect(screen.getByRole('button')).toHaveAccessibleName(/Citation 1/);
  });

  it('has no axe violations in the verified state', async () => {
    const { container } = render(<CitationMarker citation={VERIFIED} onOpen={jest.fn()} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no axe violations in the missing-coords state', async () => {
    const { container } = render(
      <CitationMarker citation={MISSING_COORDS} onOpen={jest.fn()} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
