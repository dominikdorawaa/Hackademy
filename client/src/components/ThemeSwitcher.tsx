import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import NavIconButton from './NavIconButton';

export default function ThemeSwitcher() {
  const { theme, toggleTheme } = useTheme();
  const nextLabel = theme === 'dark' ? 'Włącz jasny motyw' : 'Włącz ciemny motyw';

  return <NavIconButton className="theme-switcher-trigger"
    onClick={toggleTheme} aria-label={nextLabel} title={nextLabel}>
    {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
  </NavIconButton>;
}
