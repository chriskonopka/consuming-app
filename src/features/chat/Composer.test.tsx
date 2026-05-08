import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';

import { Composer } from './Composer';

interface HarnessOptions {
  initialValue?: string;
  isStreaming?: boolean;
  disabled?: boolean;
  onSend?: () => void;
  onAbort?: () => void;
}

const renderComposer = ({
  initialValue = '',
  isStreaming = false,
  disabled = false,
  onSend = jest.fn(),
  onAbort = jest.fn(),
}: HarnessOptions = {}) => {
  let value = initialValue;
  const onChange = jest.fn((next: string) => {
    value = next;
    rerender();
  });
  const view = render(
    <Composer
      value={value}
      isStreaming={isStreaming}
      disabled={disabled}
      onChange={onChange}
      onSend={onSend}
      onAbort={onAbort}
    />,
  );
  const rerender = () => {
    view.rerender(
      <Composer
        value={value}
        isStreaming={isStreaming}
        disabled={disabled}
        onChange={onChange}
        onSend={onSend}
        onAbort={onAbort}
      />,
    );
  };
  return { ...view, onChange, onSend, onAbort };
};

describe('Composer', () => {
  it('Send is disabled when input is empty', () => {
    renderComposer();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  });

  it('Enter sends, Shift+Enter inserts a newline', async () => {
    const user = userEvent.setup();
    const onSend = jest.fn();
    renderComposer({ initialValue: 'hello', onSend });
    const textarea = screen.getByRole('textbox', { name: 'Message' });
    await user.click(textarea);
    await user.keyboard('{Enter}');
    expect(onSend).toHaveBeenCalledTimes(1);
    onSend.mockClear();
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('replaces Send with Stop generating while streaming', () => {
    renderComposer({ initialValue: 'q', isStreaming: true });
    expect(screen.queryByRole('button', { name: 'Send message' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop generating' })).toBeInTheDocument();
  });

  it('Stop generating triggers onAbort', async () => {
    const user = userEvent.setup();
    const onAbort = jest.fn();
    renderComposer({ initialValue: 'q', isStreaming: true, onAbort });
    await user.click(screen.getByRole('button', { name: 'Stop generating' }));
    expect(onAbort).toHaveBeenCalledTimes(1);
  });

  it('disables textarea when disabled prop is set', () => {
    renderComposer({ disabled: true });
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeDisabled();
  });

  it('passes axe in idle, disabled, and streaming states', async () => {
    let view = render(
      <Composer
        value=""
        isStreaming={false}
        disabled={false}
        onChange={() => undefined}
        onSend={() => undefined}
        onAbort={() => undefined}
      />,
    );
    expect(await axe(view.container)).toHaveNoViolations();
    view.unmount();
    view = render(
      <Composer
        value="q"
        isStreaming={true}
        disabled={false}
        onChange={() => undefined}
        onSend={() => undefined}
        onAbort={() => undefined}
      />,
    );
    expect(await axe(view.container)).toHaveNoViolations();
    view.unmount();
    view = render(
      <Composer
        value=""
        isStreaming={false}
        disabled={true}
        onChange={() => undefined}
        onSend={() => undefined}
        onAbort={() => undefined}
      />,
    );
    expect(await axe(view.container)).toHaveNoViolations();
  });
});
