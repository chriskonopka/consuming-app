import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import { useUrlState } from './useUrlState';

const Probe = () => {
  const url = useUrlState();
  const location = useLocation();
  return (
    <div>
      <p data-testid="documentSetId">{url.documentSetId ?? 'null'}</p>
      <p data-testid="folderId">{url.folderId ?? 'null'}</p>
      <p data-testid="documentId">{url.documentId ?? 'null'}</p>
      <p data-testid="path">{location.pathname + location.search}</p>
      <button type="button" onClick={() => url.pushCollection('new-set')}>
        push-set
      </button>
      <button type="button" onClick={() => url.pushCollection(null)}>
        clear-set
      </button>
      <button type="button" onClick={() => url.pushDocument('new-doc')}>
        push-doc
      </button>
      <button type="button" onClick={() => url.pushDocument(null)}>
        clear-doc
      </button>
    </div>
  );
};

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="*" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  );

describe('useUrlState', () => {
  it('parses a /c/{id} path into documentSetId', () => {
    renderAt('/c/abc');
    expect(screen.getByTestId('documentSetId').textContent).toBe('abc');
    expect(screen.getByTestId('folderId').textContent).toBe('null');
    expect(screen.getByTestId('documentId').textContent).toBe('null');
  });

  it('parses folderId and documentId from the query string', () => {
    renderAt('/c/abc?folderId=f-1&documentId=d-1');
    expect(screen.getByTestId('folderId').textContent).toBe('f-1');
    expect(screen.getByTestId('documentId').textContent).toBe('d-1');
  });

  it('returns null params on the catch-all path', () => {
    renderAt('/');
    expect(screen.getByTestId('documentSetId').textContent).toBe('null');
  });

  it('pushCollection navigates to /c/{id} and drops query params', async () => {
    const user = userEvent.setup();
    renderAt('/c/old?folderId=f-1');

    await user.click(screen.getByRole('button', { name: 'push-set' }));
    expect(screen.getByTestId('path').textContent).toBe('/c/new-set');
    expect(screen.getByTestId('documentSetId').textContent).toBe('new-set');
    expect(screen.getByTestId('folderId').textContent).toBe('null');
  });

  it('pushCollection(null) navigates to /', async () => {
    const user = userEvent.setup();
    renderAt('/c/some-set');

    await user.click(screen.getByRole('button', { name: 'clear-set' }));
    expect(screen.getByTestId('path').textContent).toBe('/');
    expect(screen.getByTestId('documentSetId').textContent).toBe('null');
  });

  it('pushDocument adds documentId to the existing query string', async () => {
    const user = userEvent.setup();
    renderAt('/c/abc?folderId=f-1');

    await user.click(screen.getByRole('button', { name: 'push-doc' }));
    expect(screen.getByTestId('path').textContent).toBe('/c/abc?folderId=f-1&documentId=new-doc');
    expect(screen.getByTestId('documentId').textContent).toBe('new-doc');
  });

  it('pushDocument(null) removes documentId but keeps folderId', async () => {
    const user = userEvent.setup();
    renderAt('/c/abc?folderId=f-1&documentId=d-1');

    await user.click(screen.getByRole('button', { name: 'clear-doc' }));
    expect(screen.getByTestId('path').textContent).toBe('/c/abc?folderId=f-1');
    expect(screen.getByTestId('documentId').textContent).toBe('null');
  });

  // Back-button behavior is asserted in the Playwright E2E suite — MemoryRouter
  // maintains its own in-memory history that does not sync with window.history,
  // so an end-to-end browser navigation is the right place to verify it.
});
