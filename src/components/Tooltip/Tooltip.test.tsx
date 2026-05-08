import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';

import { Tooltip } from './index';

describe('Tooltip', () => {
  it('describes the trigger via aria-describedby', () => {
    render(
      <Tooltip content="hint text">
        <button type="button">Hover me</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole('button', { name: 'Hover me' });
    const describedBy = trigger.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const tooltip = document.getElementById(describedBy as string);
    expect(tooltip).toHaveAttribute('role', 'tooltip');
    expect(tooltip).toHaveTextContent('hint text');
  });

  it('shows on hover and hides on mouse leave', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="hint text">
        <button type="button">Hover me</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole('button', { name: 'Hover me' });
    const tooltip = screen.getByRole('tooltip');

    expect(tooltip.className).not.toMatch(/visible/);
    await user.hover(trigger);
    expect(tooltip.className).toMatch(/visible/);
    await user.unhover(trigger);
    expect(tooltip.className).not.toMatch(/visible/);
  });

  it('shows on focus and hides on blur', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Outside</button>
        <Tooltip content="hint text">
          <button type="button">Trigger</button>
        </Tooltip>
      </>,
    );
    const tooltip = screen.getByRole('tooltip');
    await user.tab(); // Outside
    await user.tab(); // Trigger
    expect(tooltip.className).toMatch(/visible/);
    await user.tab(); // Off
    expect(tooltip.className).not.toMatch(/visible/);
  });

  it('Escape dismisses an open tooltip', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="hint text">
        <button type="button">Trigger</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole('button', { name: 'Trigger' });
    const tooltip = screen.getByRole('tooltip');
    await user.hover(trigger);
    trigger.focus();
    expect(tooltip.className).toMatch(/visible/);
    await user.keyboard('{Escape}');
    expect(tooltip.className).not.toMatch(/visible/);
  });

  it('preserves the child handlers passed in', async () => {
    const onMouseEnter = jest.fn();
    const onFocus = jest.fn();
    const onKeyDown = jest.fn();
    const user = userEvent.setup();
    render(
      <Tooltip content="hint text">
        <button
          type="button"
          onMouseEnter={onMouseEnter}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
        >
          Trigger
        </button>
      </Tooltip>,
    );
    const trigger = screen.getByRole('button', { name: 'Trigger' });
    await user.hover(trigger);
    expect(onMouseEnter).toHaveBeenCalledTimes(1);
    trigger.focus();
    expect(onFocus).toHaveBeenCalledTimes(1);
    await user.keyboard('a');
    expect(onKeyDown).toHaveBeenCalled();
  });

  it('throws when a non-element child is supplied', () => {
    expect(() =>
      render(
        // @ts-expect-error -- intentionally invalid to verify the runtime guard
        <Tooltip content="x">{'plain string'}</Tooltip>,
      ),
    ).toThrow();
  });

  it.each(['top', 'bottom', 'left', 'right'] as const)(
    'positions tooltip with the %s placement class',
    (placement) => {
      render(
        <Tooltip content="hint" placement={placement}>
          <button type="button">Trigger</button>
        </Tooltip>,
      );
      expect(screen.getByRole('tooltip').className).toMatch(
        new RegExp(`placement${placement[0].toUpperCase()}${placement.slice(1)}`),
      );
    },
  );

  it('has no axe violations', async () => {
    const { container } = render(
      <Tooltip content="hint text">
        <button type="button">Trigger</button>
      </Tooltip>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
