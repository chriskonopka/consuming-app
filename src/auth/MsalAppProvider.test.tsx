jest.mock('./msalInstance');
jest.mock('@azure/msal-react', () => ({
  MsalProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { act, render, screen } from '@testing-library/react';

import { MsalAppProvider } from './MsalAppProvider';
import { useAuth } from './useAuth';

const msalMock = jest.requireMock('./msalInstance');

const Probe = () => {
  const { state } = useAuth();
  return <p data-testid="status">{state.status}</p>;
};

beforeEach(() => {
  msalMock.__resetMsalMock();
});

describe('MsalAppProvider', () => {
  it('exposes AuthContext to descendants', async () => {
    render(
      <MsalAppProvider>
        <Probe />
      </MsalAppProvider>,
    );
    await act(async () => undefined);
    expect(screen.getByTestId('status').textContent).toBe('unauthenticated');
  });
});
