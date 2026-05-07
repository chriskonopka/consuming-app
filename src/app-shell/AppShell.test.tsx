import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';

import { AppShell } from './AppShell';

describe('AppShell (scaffold)', () => {
  it('mounts and renders the scaffold health page', () => {
    render(<AppShell />);
    expect(
      screen.getByRole('heading', { name: /consuming app — scaffold health/i }),
    ).toBeInTheDocument();
  });

  it('has no accessibility violations in the scaffold state', async () => {
    const { container } = render(<AppShell />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
