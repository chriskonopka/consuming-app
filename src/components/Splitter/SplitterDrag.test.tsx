/**
 * Pointer-event drag tests for `<Splitter>`. Pointer support comes from the
 * setupTests polyfill — jsdom 20 doesn't implement `PointerEvent` natively.
 */

import { fireEvent, render, screen } from '@testing-library/react';

import { Splitter } from './index';

describe('Splitter — pointer drag', () => {
  it('reports new width as the user drags right (resizeFrom=left)', () => {
    const onResize = jest.fn();
    render(
      <Splitter
        direction="horizontal"
        widthPx={400}
        minPx={300}
        maxPx={500}
        onResize={onResize}
        ariaLabel="Resize"
      />,
    );
    const separator = screen.getByRole('separator');
    fireEvent.pointerDown(separator, { pointerId: 1, clientX: 100, clientY: 0, button: 0 });
    fireEvent.pointerMove(separator, { pointerId: 1, clientX: 130, clientY: 0 });
    expect(onResize).toHaveBeenCalledWith(430);
    fireEvent.pointerUp(separator, { pointerId: 1, clientX: 130, clientY: 0 });
  });

  it('clamps to maxPx when the drag would exceed it', () => {
    const onResize = jest.fn();
    render(
      <Splitter
        direction="horizontal"
        widthPx={400}
        minPx={300}
        maxPx={420}
        onResize={onResize}
        ariaLabel="Resize"
      />,
    );
    const separator = screen.getByRole('separator');
    fireEvent.pointerDown(separator, { pointerId: 1, clientX: 0, clientY: 0, button: 0 });
    fireEvent.pointerMove(separator, { pointerId: 1, clientX: 1000, clientY: 0 });
    expect(onResize).toHaveBeenLastCalledWith(420);
  });

  it('ignores pointer-move from a different pointerId', () => {
    const onResize = jest.fn();
    render(
      <Splitter
        direction="horizontal"
        widthPx={400}
        minPx={300}
        maxPx={500}
        onResize={onResize}
        ariaLabel="Resize"
      />,
    );
    const separator = screen.getByRole('separator');
    fireEvent.pointerMove(separator, { pointerId: 99, clientX: 200, clientY: 0 });
    expect(onResize).not.toHaveBeenCalled();
  });

  it('vertical direction reads clientY delta', () => {
    const onResize = jest.fn();
    render(
      <Splitter
        direction="vertical"
        widthPx={300}
        minPx={200}
        maxPx={400}
        onResize={onResize}
        ariaLabel="Resize"
      />,
    );
    const separator = screen.getByRole('separator');
    fireEvent.pointerDown(separator, { pointerId: 1, clientX: 0, clientY: 100, button: 0 });
    fireEvent.pointerMove(separator, { pointerId: 1, clientX: 0, clientY: 130 });
    expect(onResize).toHaveBeenCalledWith(330);
  });
});
