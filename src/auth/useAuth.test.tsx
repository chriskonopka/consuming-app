jest.mock('./msalInstance');

import { act, render } from '@testing-library/react';

import { AuthContextProvider } from './AuthContext';
import { useAuth } from './useAuth';

const msalMock = jest.requireMock('./msalInstance');

beforeEach(() => {
  msalMock.__resetMsalMock();
});

const Probe = ({ onValue }: { onValue: (v: ReturnType<typeof useAuth>) => void }) => {
  const value = useAuth();
  onValue(value);
  return null;
};

describe('useAuth', () => {
  it('returns the AuthContext value when called inside the provider', async () => {
    const seen = jest.fn();
    render(
      <AuthContextProvider>
        <Probe onValue={seen} />
      </AuthContextProvider>,
    );
    await act(async () => undefined);
    const last = seen.mock.calls[seen.mock.calls.length - 1][0];
    expect(last.state.status).toBe('unauthenticated');
    expect(typeof last.signIn).toBe('function');
    expect(typeof last.signOut).toBe('function');
    expect(typeof last.expireAuth).toBe('function');
  });

  it('throws when called outside <MsalAppProvider>', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => render(<Probe onValue={() => {}} />)).toThrow(
        'useAuth must be called inside <MsalAppProvider>',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});
