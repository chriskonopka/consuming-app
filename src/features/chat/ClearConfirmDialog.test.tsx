import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';

import { ClearConfirmDialog } from './ClearConfirmDialog';

describe('ClearConfirmDialog', () => {
  it('does not render when closed', () => {
    render(
      <ClearConfirmDialog
        open={false}
        onConfirm={() => undefined}
        onCancel={() => undefined}
        pending={false}
      />,
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('focuses Cancel on open and announces title + body', async () => {
    render(
      <ClearConfirmDialog
        open
        onConfirm={() => undefined}
        onCancel={() => undefined}
        pending={false}
      />,
    );
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveAccessibleName('Clear conversation?');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('Cancel button calls onCancel; Clear button calls onConfirm', async () => {
    const user = userEvent.setup();
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    render(
      <ClearConfirmDialog open onConfirm={onConfirm} onCancel={onCancel} pending={false} />,
    );
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Escape calls onCancel when not pending', async () => {
    const user = userEvent.setup();
    const onCancel = jest.fn();
    render(
      <ClearConfirmDialog open onConfirm={() => undefined} onCancel={onCancel} pending={false} />,
    );
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables both buttons while pending and surfaces a spinner + Clearing label', () => {
    render(
      <ClearConfirmDialog open pending onConfirm={() => undefined} onCancel={() => undefined} />,
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    // The button's accessible name now composes the spinner's aria-label with
    // the visible "Clearing…" copy — regex matches without coupling to the
    // exact concatenation order.
    expect(screen.getByRole('button', { name: /Clearing…/ })).toBeDisabled();
    expect(screen.getByRole('status', { name: 'Clearing conversation' })).toBeInTheDocument();
  });

  it('passes axe', async () => {
    const { container } = render(
      <ClearConfirmDialog
        open
        onConfirm={() => undefined}
        onCancel={() => undefined}
        pending={false}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('passes axe while pending (spinner inside the disabled confirm button)', async () => {
    const { container } = render(
      <ClearConfirmDialog open pending onConfirm={() => undefined} onCancel={() => undefined} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
