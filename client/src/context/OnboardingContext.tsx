import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { useAuth } from './AuthContext';
import { getOnboarding } from '../services/onboardingApi';
import type { OnboardingState } from '../types/api';

type Status = 'idle' | 'loading' | 'ready' | 'error';

export interface OnboardingContextValue {
  status: Status;
  state: OnboardingState | null;
  refresh: () => void;
  update: (state: OnboardingState) => void;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export function OnboardingProvider({ children }: PropsWithChildren) {
  const { token, loading } = useAuth();
  const [entry, setEntry] = useState<{ token: string; status: Exclude<Status, 'idle' | 'loading'>; state: OnboardingState | null } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    getOnboarding({ Authorization: `Bearer ${token}` }, controller.signal)
      .then(async response => {
        if (!response.ok) throw new Error('onboarding');
        const state = await response.json();
        if (!controller.signal.aborted) setEntry({ token, status: 'ready', state });
      })
      .catch(() => { if (!controller.signal.aborted) setEntry({ token, status: 'error', state: null }); });
    return () => controller.abort();
  }, [token, attempt]);

  const refresh = useCallback(() => { setEntry(null); setAttempt(value => value + 1); }, []);
  const update = useCallback((state: OnboardingState) => { if (token) setEntry({ token, status: 'ready', state }); }, [token]);
  const current = token && entry?.token === token ? entry : null;
  const status: Status = loading ? 'loading' : !token ? 'idle' : current ? current.status : 'loading';

  return <OnboardingContext.Provider value={{ status, state: current?.state ?? null, refresh, update }}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) throw new Error('useOnboarding must be used within an OnboardingProvider');
  return context;
}
