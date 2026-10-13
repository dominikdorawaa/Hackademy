import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ThemeProvider } from '../context/ThemeContext';
import ThemeSwitcher from './ThemeSwitcher';

describe('navigation theme switcher', () => {
  it('toggles directly with Enter and Space and keeps keyboard focus', async () => {
    render(<ThemeProvider><ThemeSwitcher /></ThemeProvider>);
    const user = userEvent.setup();
    await user.tab();
    const trigger = screen.getByRole('button', { name: 'Włącz jasny motyw' });
    expect(trigger).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(localStorage.getItem('app-theme')).toBe('light');
    expect(screen.getByRole('button', { name: 'Włącz ciemny motyw' })).toHaveFocus();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitemradio')).not.toBeInTheDocument();
    await user.keyboard('[Space]');
    expect(localStorage.getItem('app-theme')).toBe('dark');
    expect(screen.getByRole('button', { name: 'Włącz jasny motyw' })).toHaveFocus();
  });

  it('restores the selected theme after remount and offers both light and dark', async () => {
    const user = userEvent.setup();
    const view = render(<ThemeProvider><ThemeSwitcher /></ThemeProvider>);
    await user.click(screen.getByRole('button', { name: 'Włącz jasny motyw' }));
    view.unmount();
    render(<ThemeProvider><ThemeSwitcher /></ThemeProvider>);
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    await user.click(screen.getByRole('button', { name: 'Włącz ciemny motyw' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem('app-theme')).toBe('dark');
  });

});
