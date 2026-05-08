import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { PaperPlaneRight } from '@phosphor-icons/react';

import { IconButton } from './index';

describe('IconButton', () => {
  it('renders with the supplied aria-label', () => {
    render(<IconButton icon={PaperPlaneRight} ariaLabel="Send" onClick={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
  });

  it('invokes onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    render(<IconButton icon={PaperPlaneRight} ariaLabel="Send" onClick={onClick} />);
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disabled prevents click handler', async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    render(
      <IconButton icon={PaperPlaneRight} ariaLabel="Send" onClick={onClick} disabled />,
    );
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it.each(['default', 'primary', 'danger'] as const)('passes axe in tone=%s', async (tone) => {
    const { container } = render(
      <IconButton icon={PaperPlaneRight} ariaLabel="Send" onClick={() => undefined} tone={tone} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('reflects aria-pressed when supplied', () => {
    render(
      <IconButton
        icon={PaperPlaneRight}
        ariaLabel="Toggle"
        onClick={() => undefined}
        ariaPressed
      />,
    );
    expect(screen.getByRole('button', { name: 'Toggle', pressed: true })).toBeInTheDocument();
  });

  it('passes axe in disabled state', async () => {
    const { container } = render(
      <IconButton icon={PaperPlaneRight} ariaLabel="Send" onClick={() => undefined} disabled />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
