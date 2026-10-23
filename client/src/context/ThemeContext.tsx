import { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
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

  const toggleTheme = useCallback(() => setPreference(previous => previous === 'dark' ? 'light' : 'dark'), []);
  const resetTheme = useCallback(() => {
    setPreference('dark');
    localStorage.removeItem('app-theme');
  }, []);

  const value = useMemo(() => ({ theme, preference, setPreference, reducedMotion, setReducedMotion, toggleTheme, resetTheme }), [theme, preference, reducedMotion, toggleTheme, resetTheme]);
  return <ThemeContext.Provider value={value}>
    {children}
  </ThemeContext.Provider>;
};

const storedReducedMotion = () => {
  try { return localStorage.getItem('app-reduced-motion') === 'true'; } catch { return false; }
};

export const useAppReducedMotion = () => {
  const context = useContext(ThemeContext);
  const [stored] = useState(storedReducedMotion);
  return context ? context.reducedMotion : stored;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
