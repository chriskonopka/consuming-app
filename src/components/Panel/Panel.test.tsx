import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { useState } from 'react';

import { Panel } from './index';

const PanelHarness = ({ initialOpen = true }: { initialOpen?: boolean }) => {
  const [open, setOpen] = useState(initialOpen);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <Panel side="left" open={open} widthPx={400} onClose={() => setOpen(false)} ariaLabel="Test">
        <button type="button">First</button>
        <button type="button">Second</button>
      </Panel>
    </>
  );
};

describe('Panel', () => {
  it('does not render when closed', () => {
    render(
      <Panel side="left" open={false} widthPx={400} onClose={() => undefined} ariaLabel="X">
        <p>hidden</p>
      </Panel>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders dialog with aria-label and width when open', () => {
    render(
      <Panel side="left" open widthPx={400} onClose={() => undefined} ariaLabel="Chat">
        <p>x</p>
      </Panel>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Chat' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.style.width).toBe('400px');
  });

  it('moves focus to first focusable on open and back on close', async () => {
    const user = userEvent.setup();
    render(<PanelHarness initialOpen={false} />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    await user.click(trigger);
    await waitFor(() => expect(screen.getByRole('button', { name: 'First' })).toHaveFocus());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('traps Tab inside the panel', async () => {
    const user = userEvent.setup();
    render(<PanelHarness />);
    const first = await screen.findByRole('button', { name: 'First' });
    const second = screen.getByRole('button', { name: 'Second' });
    await waitFor(() => expect(first).toHaveFocus());
    await user.tab();
    expect(second).toHaveFocus();
    await user.tab();
    expect(first).toHaveFocus();
    await user.tab({ shift: true });
    expect(second).toHaveFocus();
  });

  it('passes axe in open state', async () => {
    const { container } = render(<PanelHarness />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('closes on backdrop click', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(
      <Panel side="left" open widthPx={400} onClose={onClose} ariaLabel="X">
        <p>x</p>
      </Panel>,
    );
    const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement;
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
