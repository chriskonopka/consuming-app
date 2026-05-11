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
      <p data-testid="doc-ids">
        {scope.state.documents.map((doc) => doc.documentId).join(',') || 'none'}
      </p>
      <p data-testid="folder-ids">
        {scope.state.folders.map((folder) => folder.folderId).join(',') || 'none'}
      </p>
      <p data-testid="doc-names">
        {scope.state.documents.map((doc) => doc.fileName).join(',') || 'none'}
      </p>
      <p data-testid="folder-paths">
        {scope.state.folders.map((folder) => folder.path).join(',') || 'none'}
      </p>
      <button
        type="button"
        onClick={() =>
          scope.setSelection(
            [{ documentId: 'doc-x', fileName: 'X.pdf' }],
            [{ folderId: 'folder-x', folderName: 'Reports', path: 'root/Reports' }],
          )
        }
      >
        set-selection
      </button>
      <button type="button" onClick={() => scope.removeDocument('doc-x')}>
        remove-doc
      </button>
      <button type="button" onClick={() => scope.removeFolder('folder-x')}>
        remove-folder
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

  it('mirrors the indexer-supplied selection (with names + paths)', async () => {
    const user = userEvent.setup();
    render(
      <ChatScopeProvider>
        <Probe />
      </ChatScopeProvider>,
    );
    await user.click(screen.getByText('set-selection'));
    expect(screen.getByTestId('doc-ids').textContent).toBe('doc-x');
    expect(screen.getByTestId('doc-names').textContent).toBe('X.pdf');
    expect(screen.getByTestId('folder-ids').textContent).toBe('folder-x');
    expect(screen.getByTestId('folder-paths').textContent).toBe('root/Reports');
  });

  it('removes targeted ids locally and clears all', async () => {
    const user = userEvent.setup();
    render(
      <ChatScopeProvider>
        <Probe />
      </ChatScopeProvider>,
    );
    await user.click(screen.getByText('set-selection'));
    await user.click(screen.getByText('remove-folder'));
    expect(screen.getByTestId('folder-ids').textContent).toBe('none');
    expect(screen.getByTestId('doc-ids').textContent).toBe('doc-x');

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
    await user.click(screen.getByText('set-selection'));
    await user.click(screen.getByText('reset'));
    expect(screen.getByTestId('doc-ids').textContent).toBe('none');
    expect(screen.getByTestId('folder-ids').textContent).toBe('none');
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
