/**
 * Hook-contract tests for `<ChatScopeProvider>` + `useChatScope()`.
 *
 * The <Probe /> below is test-only scaffolding to surface reducer state and
 * action creators through the DOM — it is not a shipped component. The real
 * UI consumer, <ScopeIndicator>, has its own axe sweep in
 * `ScopeIndicator.test.tsx`, so per web-testing.md no axe assertion is added
 * here ("Logic-only hooks (no rendered DOM output) cannot be passed to axe —
 * include a comment explaining why no axe assertion is present." Same spirit
 * applies when the rendered DOM is purely test scaffolding).
 */

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ChatScopeProvider, useChatScope } from './ChatScopeContext';

const Probe = () => {
  const scope = useChatScope();
  return (
    <>
      <p data-testid="doc-ids">{scope.state.documentIds.join(',') || 'none'}</p>
      <p data-testid="folder-ids">{scope.state.folderIds.join(',') || 'none'}</p>
      <button type="button" onClick={() => scope.toggleDocument('doc-1')}>
        toggle-doc
      </button>
      <button type="button" onClick={() => scope.toggleFolder('folder-1')}>
        toggle-folder
      </button>
      <button type="button" onClick={() => scope.removeDocument('doc-x')}>
        remove-doc
      </button>
      <button type="button" onClick={() => scope.removeFolder('folder-x')}>
        remove-folder
      </button>
      <button type="button" onClick={() => scope.setSelection(['doc-x', 'doc-y'], ['folder-x'])}>
        set-selection
      </button>
      <button type="button" onClick={() => scope.clear()}>
        clear
      </button>
      <button type="button" onClick={() => scope.resetForCollectionChange()}>
        reset
      </button>
    </>
  );
};

describe('<ChatScopeProvider> / useChatScope', () => {
  it('exposes the empty initial state', () => {
    render(
      <ChatScopeProvider>
        <Probe />
      </ChatScopeProvider>,
    );
    expect(screen.getByTestId('doc-ids').textContent).toBe('none');
    expect(screen.getByTestId('folder-ids').textContent).toBe('none');
  });

  it('toggles document and folder ids in and out of scope', async () => {
    const user = userEvent.setup();
    render(
      <ChatScopeProvider>
        <Probe />
      </ChatScopeProvider>,
    );
    await user.click(screen.getByText('toggle-doc'));
    await user.click(screen.getByText('toggle-folder'));
    expect(screen.getByTestId('doc-ids').textContent).toBe('doc-1');
    expect(screen.getByTestId('folder-ids').textContent).toBe('folder-1');

    await user.click(screen.getByText('toggle-doc'));
    expect(screen.getByTestId('doc-ids').textContent).toBe('none');
    expect(screen.getByTestId('folder-ids').textContent).toBe('folder-1');
  });

  it('removes targeted ids and clears all', async () => {
    const user = userEvent.setup();
    render(
      <ChatScopeProvider>
        <Probe />
      </ChatScopeProvider>,
    );
    await user.click(screen.getByText('set-selection'));
    expect(screen.getByTestId('doc-ids').textContent).toBe('doc-x,doc-y');
    expect(screen.getByTestId('folder-ids').textContent).toBe('folder-x');

    await user.click(screen.getByText('remove-folder'));
    expect(screen.getByTestId('folder-ids').textContent).toBe('none');

    await user.click(screen.getByText('clear'));
    expect(screen.getByTestId('doc-ids').textContent).toBe('none');
  });

  it('resetForCollectionChange behaves like clear', async () => {
    const user = userEvent.setup();
    render(
      <ChatScopeProvider>
        <Probe />
      </ChatScopeProvider>,
    );
    await user.click(screen.getByText('toggle-doc'));
    await user.click(screen.getByText('reset'));
    expect(screen.getByTestId('doc-ids').textContent).toBe('none');
  });

  it('throws a clear error when the hook is used outside the provider', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => {
      act(() => {
        render(<Probe />);
      });
    }).toThrow('useChatScope must be called inside <ChatScopeProvider>');
    errorSpy.mockRestore();
  });
});
