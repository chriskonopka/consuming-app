import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';

import { Pill } from './index';

const TONES = ['neutral', 'info', 'success', 'warning', 'error'] as const;

describe('Pill', () => {
  it('renders the supplied label and uses it as the default aria-label', () => {
    render(<Pill label="Financial" tone="info" />);
    const node = screen.getByLabelText('Financial');
    expect(node).toHaveTextContent('Financial');
  });

  it('uses an explicit aria-label override when provided', () => {
    render(<Pill label="FN" tone="info" ariaLabel="Financial document" />);
    expect(screen.getByLabelText('Financial document')).toBeInTheDocument();
  });

  it.each(TONES)('applies the %s tone class', (tone) => {
    render(<Pill label="X" tone={tone} />);
    const node = screen.getByLabelText('X');
    const expected = `tone${tone[0].toUpperCase()}${tone.slice(1)}`;
    expect(node.className).toMatch(new RegExp(expected));
  });

  it('renders the truncation class when truncated is true', () => {
    render(<Pill label="A really long label" tone="neutral" truncated />);
    const node = screen.getByLabelText('A really long label');
    expect(node.className).toMatch(/truncated/);
  });

  it('does not wrap in a tooltip when not overflowing', () => {
    // jsdom returns 0 for scrollWidth/clientWidth — so isOverflowing stays false
    // and no role=tooltip is added.
    render(<Pill label="short" tone="info" truncated />);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('wraps in a tooltip when label overflows', () => {
    // Force overflow detection by stubbing the layout properties before render.
    const originalScroll = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollWidth',
    );
    const originalClient = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'clientWidth',
    );
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get: () => 200,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 50,
    });
    try {
      render(<Pill label="A really long label" tone="info" truncated />);
      expect(screen.getByRole('tooltip')).toHaveTextContent('A really long label');
    } finally {
      if (originalScroll) {
        Object.defineProperty(HTMLElement.prototype, 'scrollWidth', originalScroll);
      }
      if (originalClient) {
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClient);
      }
    }
  });

  it('has no axe violations', async () => {
    const { container } = render(<Pill label="Financial" tone="info" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
