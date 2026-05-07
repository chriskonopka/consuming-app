import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';

import { HealthPage } from './HealthPage';

describe('HealthPage', () => {
  it('renders the scaffold health page', () => {
    render(<HealthPage />);
    expect(
      screen.getByRole('heading', { name: /consuming app — scaffold health/i }),
    ).toBeInTheDocument();
  });

  it('reports a status (OK or Degraded depending on env at test time)', () => {
    render(<HealthPage />);
    const status = screen.getByTestId('health-status');
    expect(status.textContent).toMatch(/^(OK|Degraded)$/);
  });

  it('lists every required configuration key in the dl', () => {
    render(<HealthPage />);
    expect(screen.getByText('API base URL')).toBeInTheDocument();
    expect(screen.getByText('Indexer remote URL')).toBeInTheDocument();
    expect(screen.getByText('MSAL client ID')).toBeInTheDocument();
    expect(screen.getByText('MSAL authority')).toBeInTheDocument();
    expect(screen.getByText('MSAL API scope')).toBeInTheDocument();
    expect(screen.getByText('App Insights')).toBeInTheDocument();
  });

  it('has no accessibility violations in the default render', async () => {
    const { container } = render(<HealthPage />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
