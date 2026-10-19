import { PROFILE_UPDATED } from '../lib/profile';
import type { ProfilePersonalization } from '../lib/profile';
import { createContext, useState, useContext, useEffect, useLayoutEffect, useCallback } from 'react';
import type { PropsWithChildren } from 'react';
import { useAuth as useClerkAuth, useClerk } from '@clerk/react';
import { registerSession } from '../services/http';
import { getCurrentUser } from '../services/userApi';
import type { DashboardUser } from '../types/api';

export type AuthUser = DashboardUser;
export interface AuthContextValue {
  sessionKey: string | null;
  user: AuthUser | null;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const { isLoaded, isSignedIn, sessionId, getToken } = useClerkAuth();
  const { signOut } = useClerk();
  const sessionKey = isSignedIn ? sessionId ?? null : null;
  const [profile, setProfile] = useState<{ sessionKey: string; user: AuthUser } | null>(null);
  const [expiredSession, setExpiredSession] = useState<string | null>(null);
  const authenticated = !!sessionKey && expiredSession !== sessionKey;
  const logout = useCallback(async () => {
    setExpiredSession(sessionKey);
    await signOut();
  }, [signOut, sessionKey]);

  useEffect(() => { try { localStorage.removeItem('token'); } catch { return; } }, []);
  useLayoutEffect(() => {
    if (!sessionKey || !authenticated) return;
    return registerSession({ sessionKey, getToken, expired: () => { void logout(); } });
  }, [sessionKey, authenticated, getToken, logout]);

  useEffect(() => {
    const update = (event: Event) => {
      const changed = (event as CustomEvent<ProfilePersonalization & { username: string }>).detail;
      setProfile(previous => previous?.user.username === changed.username ? { ...previous, user: { ...previous.user, ...changed } } : previous);
    };
    window.addEventListener(PROFILE_UPDATED, update);
    return () => window.removeEventListener(PROFILE_UPDATED, update);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!sessionKey || !authenticated) return;
    const response = await getCurrentUser({ sessionKey });
    if (!response.ok) throw new Error('Nie udało się pobrać konta.');
    setProfile({ sessionKey, user: await response.json() });
  }, [sessionKey, authenticated]);

  useEffect(() => {
    if (!sessionKey || !authenticated) return;
    const controller = new AbortController();
    getCurrentUser({ sessionKey }, controller.signal).then(async response => {
      if (!response.ok) throw new Error('Nie udało się pobrać konta.');
      const user = await response.json();
      if (!controller.signal.aborted) setProfile({ sessionKey, user });
    }).catch(() => {});
    return () => controller.abort();
  }, [sessionKey, authenticated]);

  const user = authenticated && profile?.sessionKey === sessionKey ? profile.user : null;
  const loading = !isLoaded;
  return <AuthContext.Provider value={{ sessionKey: authenticated ? sessionKey : null, user, logout, refreshUser, isAuthenticated: authenticated, loading }}>
    {children}
  </AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
