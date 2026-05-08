import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';

import { PageNavigation } from './PageNavigation';

describe('PageNavigation', () => {
  it('renders the current page in the input and the total in the suffix', () => {
    render(<PageNavigation page={3} totalPages={12} onPageChange={jest.fn()} />);
    expect(screen.getByRole('spinbutton', { name: 'Go to page' })).toHaveValue(3);
    expect(screen.getByText('of 12')).toBeInTheDocument();
  });

  it('disables Previous on page 1 and Next on the last page', () => {
    render(<PageNavigation page={1} totalPages={3} onPageChange={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled();

    render(<PageNavigation page={3} totalPages={3} onPageChange={jest.fn()} />);
    expect(screen.getAllByRole('button', { name: 'Next page' })[1]).toBeDisabled();
  });

  it('Previous and Next dispatch the new page', async () => {
    const onPageChange = jest.fn();
    const user = userEvent.setup();
    render(<PageNavigation page={3} totalPages={5} onPageChange={onPageChange} />);

    await user.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(onPageChange).toHaveBeenLastCalledWith(2);

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenLastCalledWith(4);
  });

  it('committing a typed page on form-submit dispatches the clamped value', async () => {
    const onPageChange = jest.fn();
    const user = userEvent.setup();
    const { container } = render(
      <PageNavigation page={1} totalPages={5} onPageChange={onPageChange} />,
    );
    const input = screen.getByRole('spinbutton', { name: 'Go to page' });
    await user.clear(input);
    await user.type(input, '99');
    const form = container.querySelector('form');
    if (!form) throw new Error('expected form element');
    fireEvent.submit(form);
    expect(onPageChange).toHaveBeenLastCalledWith(5);
  });

  it('clamps below 1 to 1', async () => {
    const onPageChange = jest.fn();
    const user = userEvent.setup();
    const { container } = render(
      <PageNavigation page={3} totalPages={5} onPageChange={onPageChange} />,
    );
    const input = screen.getByRole('spinbutton', { name: 'Go to page' });
    await user.clear(input);
    await user.type(input, '0');
    const form = container.querySelector('form');
    if (!form) throw new Error('expected form element');
    fireEvent.submit(form);
    expect(onPageChange).toHaveBeenLastCalledWith(1);
  });

  it('on blur with a non-numeric value, restores the canonical page', async () => {
    const onPageChange = jest.fn();
    const user = userEvent.setup();
    render(<PageNavigation page={3} totalPages={5} onPageChange={onPageChange} />);
    const input = screen.getByRole('spinbutton', { name: 'Go to page' }) as HTMLInputElement;
    await user.clear(input);
    // Simulate non-parseable text via fireEvent since type=number rejects letters.
    input.value = '';
    await user.tab();
    expect(input.value).toBe('3');
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('disables nav controls when disabled prop is true', () => {
    render(<PageNavigation page={2} totalPages={5} onPageChange={jest.fn()} disabled />);
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    expect(screen.getByRole('spinbutton', { name: 'Go to page' })).toBeDisabled();
  });

  it('shows a placeholder total when no pages loaded yet', () => {
    render(<PageNavigation page={1} totalPages={0} onPageChange={jest.fn()} />);
    expect(screen.getByText('of —')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <PageNavigation page={1} totalPages={5} onPageChange={jest.fn()} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
