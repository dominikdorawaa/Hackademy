import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from './ThemeContext';

function ThemeControls() {
  const { theme, toggleTheme, resetTheme } = useTheme();
  return <>
    <output>{theme}</output>
    <button onClick={toggleTheme}>toggle</button>
    <button onClick={resetTheme}>reset</button>
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

  it.each([false, true])('migrates the saved system choice once, with dark preference %s', dark => {
    localStorage.setItem('app-theme', 'system');
    const query = { matches: dark, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal('matchMedia', vi.fn(() => query));
    try {
      const view = render(<ThemeProvider><ThemeControls /></ThemeProvider>);
      const expected = dark ? 'dark' : 'light';
      expect(document.documentElement.getAttribute('data-theme')).toBe(expected);
      expect(localStorage.getItem('app-theme')).toBe(expected);
      expect(query.addEventListener).not.toHaveBeenCalled();
      query.matches = !dark;
      view.unmount();
      render(<ThemeProvider><ThemeControls /></ThemeProvider>);
      expect(document.documentElement.getAttribute('data-theme')).toBe(expected);
    } finally { vi.unstubAllGlobals(); }
  });

  it('migrates a system choice to dark when system theme detection is unavailable', () => {
    localStorage.setItem('app-theme', 'system');
    vi.stubGlobal('matchMedia', undefined);
    render(<ThemeProvider><ThemeControls /></ThemeProvider>);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('app-theme')).toBe('dark');
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
