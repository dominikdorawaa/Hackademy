import { createContext, useState, useContext, useEffect } from 'react';
import type { PropsWithChildren } from 'react';

export type ThemePreference = 'dark' | 'light' | 'system';

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
    return saved === 'light' || saved === 'system' ? saved : 'dark';
  });
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true);
  const [reducedMotion, setReducedMotion] = useState(() => localStorage.getItem('app-reduced-motion') === 'true');
  const theme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!query) return;
    const changed = () => setSystemDark(query.matches);
    query.addEventListener('change', changed);
    return () => query.removeEventListener('change', changed);
  }, []);

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
