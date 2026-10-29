import { useLayoutEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import * as userApi from '../services/userApi';
import { usernameProblem } from '../lib/username';

export type UsernameChangeResult = { ok: true; username: string } | { ok: false; error: string; unauthorized?: boolean };

export function validateUsername(value: string) {
  const problem = usernameProblem(value.trim());
  return problem && `${problem}.`;
}

async function failure(response: Awaited<ReturnType<typeof userApi.changeUsername>>): Promise<UsernameChangeResult> {
  if (response.status === 401) return { ok: false, error: 'Sesja wygasła. Zaloguj się ponownie.', unauthorized: true };
  if (response.status === 409) return { ok: false, error: 'Ta nazwa jest już zajęta. Wybierz inną.' };
  try {
    const body = await response.json() as unknown as Record<string, unknown>;
    if (typeof body.newUsername === 'string') return { ok: false, error: `${body.newUsername}.` };
  } catch { /* fall through to the generic message */ }
  return { ok: false, error: 'Nie udało się zmienić nazwy użytkownika. Spróbuj ponownie.' };
}

export function useUsernameChange() {
  const { sessionKey, refreshUser } = useAuth();
  const activeToken = useRef(sessionKey);
  useLayoutEffect(() => { activeToken.current = sessionKey; }, [sessionKey]);
  const submitting = useRef(false);
  const [changing, setChanging] = useState(false);

  const change = async (value: string): Promise<UsernameChangeResult | null> => {
    const username = value.trim();
    const invalid = validateUsername(username);
    if (invalid) return { ok: false, error: invalid };
    if (!sessionKey || submitting.current) return null;
    submitting.current = true;
    setChanging(true);
    try {
      const response = await userApi.changeUsername(username, { sessionKey });
      if (!response.ok) return activeToken.current === sessionKey ? await failure(response) : null;
      await response.json();
      if (activeToken.current !== sessionKey) return null;
      await refreshUser().catch(() => undefined);
      return { ok: true, username };
    } catch {
      return activeToken.current === sessionKey ? { ok: false, error: 'Nie udało się połączyć z serwerem. Spróbuj ponownie.' } : null;
    } finally {
      submitting.current = false;
      setChanging(false);
    }
  };

  return { change, changing };
}
