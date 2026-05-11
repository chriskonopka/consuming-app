import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';

import { ScopeIndicator } from './ScopeIndicator';

const sampleState = {
  documents: [
    { documentId: 'doc-a', fileName: 'Quarterly report.pdf' },
    { documentId: 'doc-b', fileName: 'Contract.pdf' },
  ],
  folders: [{ folderId: 'folder-1', folderName: 'Reports', path: 'root/Reports' }],
};

describe('<ScopeIndicator>', () => {
  it('renders nothing when both arrays are empty', () => {
    const { container } = render(
      <ScopeIndicator
        state={{ documents: [], folders: [] }}
        onRemoveDocument={jest.fn()}
        onRemoveFolder={jest.fn()}
        onClearAll={jest.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders one chip per document and folder using the event-supplied names', () => {
    render(
      <ScopeIndicator
        state={sampleState}
        onRemoveDocument={jest.fn()}
        onRemoveFolder={jest.fn()}
        onClearAll={jest.fn()}
      />,
    );
    expect(screen.getByLabelText('Chat scope')).toBeInTheDocument();
    expect(screen.getByText('Scoped to 3')).toBeInTheDocument();
    expect(screen.getByText('Quarterly report.pdf')).toBeInTheDocument();
    expect(screen.getByText('Contract.pdf')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
  });

  it('exposes the folder path as the chip title attribute', () => {
    render(
      <ScopeIndicator
        state={sampleState}
        onRemoveDocument={jest.fn()}
        onRemoveFolder={jest.fn()}
        onClearAll={jest.fn()}
      />,
    );
    expect(screen.getByText('Reports')).toHaveAttribute('title', 'root/Reports');
  });

  it('calls onRemoveDocument with the right id when × is clicked', async () => {
    const user = userEvent.setup();
    const onRemoveDocument = jest.fn();
    render(
      <ScopeIndicator
        state={sampleState}
        onRemoveDocument={onRemoveDocument}
        onRemoveFolder={jest.fn()}
        onClearAll={jest.fn()}
      />,
    );
    await user.click(
      screen.getByRole('button', { name: 'Remove Quarterly report.pdf from chat scope' }),
    );
    expect(onRemoveDocument).toHaveBeenCalledWith('doc-a');
  });

  it('calls onRemoveFolder for folder chips', async () => {
    const user = userEvent.setup();
    const onRemoveFolder = jest.fn();
    render(
      <ScopeIndicator
        state={sampleState}
        onRemoveDocument={jest.fn()}
        onRemoveFolder={onRemoveFolder}
        onClearAll={jest.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Remove folder Reports from chat scope' }));
    expect(onRemoveFolder).toHaveBeenCalledWith('folder-1');
  });

  it('fires onClearAll from the Clear all button', async () => {
    const user = userEvent.setup();
    const onClearAll = jest.fn();
    render(
      <ScopeIndicator
        state={sampleState}
        onRemoveDocument={jest.fn()}
        onRemoveFolder={jest.fn()}
        onClearAll={onClearAll}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(onClearAll).toHaveBeenCalled();
  });

  it('has no axe violations in the populated state', async () => {
    const { container } = render(
      <ScopeIndicator
        state={sampleState}
        onRemoveDocument={jest.fn()}
        onRemoveFolder={jest.fn()}
        onClearAll={jest.fn()}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
