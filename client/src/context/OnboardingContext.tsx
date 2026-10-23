import { createContext, useCallback, useContext, useEffect, useState, useMemo } from 'react';
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
  const { sessionKey, loading } = useAuth();
  const [entry, setEntry] = useState<{ sessionKey: string; status: Exclude<Status, 'idle' | 'loading'>; state: OnboardingState | null } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!sessionKey) return;
    const controller = new AbortController();
    getOnboarding({ sessionKey }, controller.signal)
      .then(async response => {
        if (!response.ok) throw new Error('onboarding');
        const state = await response.json();
        if (!controller.signal.aborted) setEntry({ sessionKey, status: 'ready', state });
      })
      .catch(() => { if (!controller.signal.aborted) setEntry({ sessionKey, status: 'error', state: null }); });
    return () => controller.abort();
  }, [sessionKey, attempt]);

  const refresh = useCallback(() => { setEntry(null); setAttempt(value => value + 1); }, []);
  const update = useCallback((state: OnboardingState) => { if (sessionKey) setEntry({ sessionKey, status: 'ready', state }); }, [sessionKey]);
  const current = sessionKey && entry?.sessionKey === sessionKey ? entry : null;
  const status: Status = loading ? 'loading' : !sessionKey ? 'idle' : current ? current.status : 'loading';

  const value = useMemo(() => ({ status, state: current?.state ?? null, refresh, update }), [status, current?.state, refresh, update]);
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) throw new Error('useOnboarding must be used within an OnboardingProvider');
  return context;
}
