import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';

import { LoadingSpinner } from './index';

describe('LoadingSpinner', () => {
  it('exposes a polite live region with the supplied label', () => {
    render(<LoadingSpinner ariaLabel="Loading conversation" />);
    const status = screen.getByRole('status', { name: 'Loading conversation' });
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it.each(['small', 'medium', 'large'] as const)('passes axe at size=%s', async (size) => {
    const { container } = render(<LoadingSpinner ariaLabel="Loading" size={size} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
