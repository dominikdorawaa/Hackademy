import { createContext, useState, useContext, useEffect } from 'react';
import type { PropsWithChildren } from 'react';

export type ThemePreference = 'dark' | 'light';

export interface ThemeContextValue {
  theme: string;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  reducedMotion: boolean;
  setReducedMotion: (value: boolean) => void;
  toggleTheme: () => void;
  resetTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider = ({ children }: PropsWithChildren) => {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    const saved = localStorage.getItem('app-theme');
    if (saved === 'system') return window.matchMedia?.('(prefers-color-scheme: dark)').matches === false ? 'light' : 'dark';
    return saved === 'light' ? 'light' : 'dark';
  });
  const [reducedMotion, setReducedMotion] = useState(() => localStorage.getItem('app-reduced-motion') === 'true');
  const theme = preference;

  useEffect(() => {
    localStorage.setItem('app-theme', preference);
    document.documentElement.setAttribute('data-theme', theme);
  }, [preference, theme]);

  useEffect(() => {
    localStorage.setItem('app-reduced-motion', String(reducedMotion));
    document.documentElement.setAttribute('data-reduced-motion', String(reducedMotion));
  }, [reducedMotion]);

  const toggleTheme = () => setPreference(theme === 'dark' ? 'light' : 'dark');
  const resetTheme = () => {
    setPreference('dark');
    localStorage.removeItem('app-theme');
  };

  return <ThemeContext.Provider value={{ theme, preference, setPreference, reducedMotion, setReducedMotion, toggleTheme, resetTheme }}>
    {children}
  </ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
