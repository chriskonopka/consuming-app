import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

import { THEME_PREFERENCE_KEY } from '@shared/types';

import { ThemeProvider } from './ThemeProvider';
import { useTheme } from './useTheme';

const wrapper = ({ children }: { children: ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe('ThemeProvider', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    window.localStorage.clear();
  });

  it('reads the initial theme from data-theme attribute set by the inline script', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe('dark');
  });

  it('toggles to dark and persists to localStorage', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => result.current.setTheme('dark'));
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(window.localStorage.getItem(THEME_PREFERENCE_KEY)).toBe('dark');
  });

  it('toggles back to light and updates the DOM attribute', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => result.current.setTheme('light'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(window.localStorage.getItem(THEME_PREFERENCE_KEY)).toBe('light');
  });

  it('throws when useTheme is used outside ThemeProvider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useTheme())).toThrow(/within <ThemeProvider>/);
    consoleError.mockRestore();
  });

  it('integrates with a clickable toggle in the DOM', async () => {
    document.documentElement.setAttribute('data-theme', 'light');
    const Toggle = () => {
      const { theme, setTheme } = useTheme();
      return (
        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          theme={theme}
        </button>
      );
    };
    render(
      <ThemeProvider>
        <Toggle />
      </ThemeProvider>,
    );
    expect(screen.getByRole('button')).toHaveTextContent('theme=light');
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent('theme=dark');
  });
});
