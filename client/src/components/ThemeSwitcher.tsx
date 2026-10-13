import { Check, Moon, Sun } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { useTheme } from '../context/ThemeContext';
import type { ThemePreference } from '../context/ThemeContext';
import { Button } from './ui/button';
import './ThemeSwitcher.css';

const options = [
  { value: 'light', label: 'Jasny', icon: Sun },
  { value: 'dark', label: 'Ciemny', icon: Moon },
] as const;

export default function ThemeSwitcher() {
  const { preference, setPreference } = useTheme();
  const current = options.find(option => option.value === preference)!;
  const Icon = current.icon;

  return <DropdownMenu.Root>
    <DropdownMenu.Trigger asChild>
      <Button type="button" variant="ghost" size="icon" className="theme-switcher-trigger"
        aria-label={`Zmień motyw: ${current.label.toLowerCase()}`} title={`Motyw: ${current.label}`}>
        <Icon aria-hidden="true" />
      </Button>
    </DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content className="theme-switcher-menu" align="end" sideOffset={8} collisionPadding={12}>
        <DropdownMenu.Label className="theme-switcher-label">Motyw aplikacji</DropdownMenu.Label>
        <DropdownMenu.RadioGroup value={preference} onValueChange={value => setPreference(value as ThemePreference)}>
          {options.map(option => <DropdownMenu.RadioItem key={option.value} value={option.value} className="theme-switcher-option">
            <option.icon aria-hidden="true" />
            <span>{option.label}</span>
            <DropdownMenu.ItemIndicator className="theme-switcher-selected"><Check aria-hidden="true" /></DropdownMenu.ItemIndicator>
          </DropdownMenu.RadioItem>)}
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>;
}
