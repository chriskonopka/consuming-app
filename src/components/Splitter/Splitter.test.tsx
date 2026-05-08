import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';

import { Splitter } from './index';

describe('Splitter', () => {
  const setup = () => {
    const onResize = jest.fn();
    const view = render(
      <Splitter
        direction="horizontal"
        widthPx={400}
        minPx={300}
        maxPx={500}
        onResize={onResize}
        ariaLabel="Resize chat panel"
      />,
    );
    return { onResize, ...view };
  };

  it('exposes a separator role with valuenow / min / max', () => {
    setup();
    const separator = screen.getByRole('separator', { name: 'Resize chat panel' });
    expect(separator).toHaveAttribute('aria-valuenow', '400');
    expect(separator).toHaveAttribute('aria-valuemin', '300');
    expect(separator).toHaveAttribute('aria-valuemax', '500');
  });

  it('keyboard ArrowRight increases width by 10px', async () => {
    const user = userEvent.setup();
    const { onResize } = setup();
    const separator = screen.getByRole('separator');
    separator.focus();
    await user.keyboard('{ArrowRight}');
    expect(onResize).toHaveBeenCalledWith(410);
  });

  it('keyboard ArrowLeft decreases width by 10px', async () => {
    const user = userEvent.setup();
    const { onResize } = setup();
    const separator = screen.getByRole('separator');
    separator.focus();
    await user.keyboard('{ArrowLeft}');
    expect(onResize).toHaveBeenCalledWith(390);
  });

  it('clamps to maxPx with End', async () => {
    const user = userEvent.setup();
    const { onResize } = setup();
    const separator = screen.getByRole('separator');
    separator.focus();
    await user.keyboard('{End}');
    expect(onResize).toHaveBeenCalledWith(500);
  });

  it('clamps to minPx with Home', async () => {
    const user = userEvent.setup();
    const { onResize } = setup();
    const separator = screen.getByRole('separator');
    separator.focus();
    await user.keyboard('{Home}');
    expect(onResize).toHaveBeenCalledWith(300);
  });

  it('respects resizeFrom=right (drag right shrinks width)', async () => {
    const user = userEvent.setup();
    const onResize = jest.fn();
    render(
      <Splitter
        direction="horizontal"
        resizeFrom="right"
        widthPx={400}
        minPx={300}
        maxPx={500}
        onResize={onResize}
        ariaLabel="Right splitter"
      />,
    );
    const separator = screen.getByRole('separator');
    separator.focus();
    await user.keyboard('{ArrowRight}');
    expect(onResize).toHaveBeenCalledWith(390);
  });

  it('passes axe', async () => {
    const { container } = setup();
    expect(await axe(container)).toHaveNoViolations();
  });
});
