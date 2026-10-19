import { useSyncExternalStore } from 'react';
import { vi } from 'vitest';

let token: string | null = null;
let loaded = true;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getToken = vi.fn(async () => token);
export const openUserProfile = vi.fn();
export const signOut = vi.fn(async () => { setClerkSession(null); });
export function setClerkSession(next: string | null, isLoaded = true) {
  token = next;
  loaded = isLoaded;
  listeners.forEach(listener => listener());
}
export function useMockAuth() {
  useSyncExternalStore(subscribe, () => `${loaded}:${token}`);
  return { isLoaded: loaded, isSignedIn: !!token, sessionId: token ? `session:${token}` : null, getToken };
}
export function useMockClerk() { return { signOut, openUserProfile }; }
export function MockSignIn() { return <div data-testid="clerk-sign-in">Logowanie Clerk</div>; }
export function MockSignUp() { return <div data-testid="clerk-sign-up">Rejestracja Clerk</div>; }
