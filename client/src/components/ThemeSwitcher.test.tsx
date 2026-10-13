import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ThemeProvider } from '../context/ThemeContext';
import ThemeSwitcher from './ThemeSwitcher';

describe('navigation theme switcher', () => {
  it('supports keyboard selection, reports the selected theme and restores focus', async () => {
    render(<ThemeProvider><ThemeSwitcher /></ThemeProvider>);
    const user = userEvent.setup();
    await user.tab();
    const trigger = screen.getByRole('button', { name: 'Zmień motyw: ciemny' });
    expect(trigger).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('menuitemradio', { name: 'Ciemny' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(2);
    expect(screen.queryByRole('menuitemradio', { name: 'Systemowy' })).not.toBeInTheDocument();
    await user.keyboard('{Home}{Enter}');
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(localStorage.getItem('app-theme')).toBe('light');
    expect(screen.getByRole('button', { name: 'Zmień motyw: jasny' })).toHaveFocus();
    await user.keyboard('{Enter}{End}{Enter}');
    expect(localStorage.getItem('app-theme')).toBe('dark');
    expect(screen.getByRole('button', { name: 'Zmień motyw: ciemny' })).toHaveFocus();
  });

  it('restores the selected theme after remount and offers both light and dark', async () => {
    const user = userEvent.setup();
    const view = render(<ThemeProvider><ThemeSwitcher /></ThemeProvider>);
    await user.click(screen.getByRole('button', { name: /Zmień motyw/ }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Jasny' }));
    view.unmount();
    render(<ThemeProvider><ThemeSwitcher /></ThemeProvider>);
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    await user.click(screen.getByRole('button', { name: 'Zmień motyw: jasny' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Ciemny' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem('app-theme')).toBe('dark');
  });

  it('closes with Escape without changing the current preference', async () => {
    render(<ThemeProvider><ThemeSwitcher /></ThemeProvider>);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Zmień motyw/ }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(localStorage.getItem('app-theme')).toBe('dark');
    expect(screen.getByRole('button', { name: 'Zmień motyw: ciemny' })).toHaveFocus();
  });
});
