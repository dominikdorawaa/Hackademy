import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
  it.each([null, 'light', 'custom-theme', ''])('restores the saved theme %s without normalization', saved => {
    if (saved !== null) localStorage.setItem('app-theme', saved);
    render(<ThemeProvider><ThemeControls /></ThemeProvider>);
    expect(document.documentElement.getAttribute('data-theme')).toBe(saved || 'dark');
    expect(localStorage.getItem('app-theme')).toBe(saved || 'dark');
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
