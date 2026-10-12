import { fireEvent, render, screen } from '@testing-library/react';
import { act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from './ThemeContext';

function ThemeControls() {
  const { theme, toggleTheme, resetTheme, setPreference } = useTheme();
  return <>
    <output>{theme}</output>
    <button onClick={toggleTheme}>toggle</button>
    <button onClick={resetTheme}>reset</button>
    <button onClick={() => setPreference('system')}>system</button>
  </>;
}

describe('theme behavior', () => {
  it.each([null, 'light', 'custom-theme', ''])('restores valid themes and normalizes invalid values: %s', saved => {
    if (saved !== null) localStorage.setItem('app-theme', saved);
    render(<ThemeProvider><ThemeControls /></ThemeProvider>);
    const expected = saved === 'light' ? 'light' : 'dark';
    expect(document.documentElement.getAttribute('data-theme')).toBe(expected);
    expect(localStorage.getItem('app-theme')).toBe(expected);
  });

  it('tracks system color changes without replacing the saved system preference', () => {
    let onChange = () => {};
    const query = { matches: false, addEventListener: vi.fn((_name, listener) => { onChange = listener; }), removeEventListener: vi.fn() };
    vi.stubGlobal('matchMedia', vi.fn(() => query));
    try {
      render(<ThemeProvider><ThemeControls /></ThemeProvider>);
      fireEvent.click(screen.getByText('system'));
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      query.matches = true;
      act(() => onChange());
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(localStorage.getItem('app-theme')).toBe('system');
    } finally { vi.unstubAllGlobals(); }
  });

  it('toggles and resets with the original storage/effect ordering', () => {
    render(<ThemeProvider><ThemeControls /></ThemeProvider>);
    fireEvent.click(screen.getByText('toggle'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('app-theme')).toBe('light');
    fireEvent.click(screen.getByText('reset'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('app-theme')).toBe('dark');

    fireEvent.click(screen.getByText('reset'));
    expect(localStorage.getItem('app-theme')).toBeNull();
  });
});
