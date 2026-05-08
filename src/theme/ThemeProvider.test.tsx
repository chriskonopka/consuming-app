import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';

import { ThemeProvider } from './ThemeProvider';
import { useTheme } from './useTheme';

const Consumer = () => {
  const { theme, setTheme } = useTheme();
  return (
    <div>
      <p data-testid="theme">{theme}</p>
      <button type="button" onClick={() => setTheme('dark')}>
        dark
      </button>
      <button type="button" onClick={() => setTheme('light')}>
        light
      </button>
    </div>
  );
};

describe('ThemeProvider', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    window.localStorage.clear();
  });

  it("reads the document's data-theme attribute on first render", () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('theme').textContent).toBe('dark');
  });

  it("defaults to light when data-theme is missing", () => {
    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('theme').textContent).toBe('light');
  });

  it('updates DOM, state, and localStorage on setTheme', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'dark' }));
    expect(screen.getByTestId('theme').textContent).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(window.localStorage.getItem('theme-preference')).toBe('dark');

    await user.click(screen.getByRole('button', { name: 'light' }));
    expect(screen.getByTestId('theme').textContent).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(window.localStorage.getItem('theme-preference')).toBe('light');
  });

  it('does not throw when localStorage is unavailable', async () => {
    const user = userEvent.setup();
    const original = window.localStorage.setItem;
    window.localStorage.setItem = () => {
      throw new Error('quota exceeded');
    };
    try {
      render(
        <ThemeProvider>
          <Consumer />
        </ThemeProvider>,
      );
      await user.click(screen.getByRole('button', { name: 'dark' }));
      // DOM still updates even though storage failed.
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    } finally {
      window.localStorage.setItem = original;
    }
  });

  it('throws when useTheme is called outside the provider', () => {
    // Suppress the React error log for this expected throw.
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => render(<Consumer />)).toThrow(
        'useTheme must be called inside <ThemeProvider>',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('renders without accessibility violations in both themes', async () => {
    const user = userEvent.setup();
    const { container, rerender } = render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>,
    );
    expect(await axe(container)).toHaveNoViolations();

    await user.click(screen.getByRole('button', { name: 'dark' }));
    rerender(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
