import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';

import { StatusRow } from './StatusRow';

describe('StatusRow', () => {
  it('renders nothing when not visible', () => {
    const { container } = render(
      <StatusRow state={{ visible: false, primary: '', fallback: null }} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the primary phase as a polite live region', async () => {
    const { container } = render(
      <StatusRow state={{ visible: true, primary: 'Reading your collection', fallback: null }} />,
    );
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('aria-atomic', 'true');
    expect(status).toHaveTextContent('Reading your collection');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('prefers fallback phrase when present', () => {
    render(
      <StatusRow
        state={{ visible: true, primary: 'Thinking…', fallback: 'Working through the question' }}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Working through the question');
  });
});
