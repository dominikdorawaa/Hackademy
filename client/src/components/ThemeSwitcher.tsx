import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { Button } from './ui/button';
import './ThemeSwitcher.css';

export default function ThemeSwitcher() {
  const { theme, toggleTheme } = useTheme();
  const nextLabel = theme === 'dark' ? 'Włącz jasny motyw' : 'Włącz ciemny motyw';

  return <Button type="button" variant="ghost" size="icon" className="theme-switcher-trigger"
    onClick={toggleTheme} aria-label={nextLabel} title={nextLabel}>
    {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
  </Button>;
}
