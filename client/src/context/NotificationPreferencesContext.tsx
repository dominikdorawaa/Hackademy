import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { useAuth } from './AuthContext';
import { defaultNotificationPreferences, getNotificationPreferences, saveNotificationPreferences } from '../services/userApi';
import type { NotificationPreferences } from '../services/userApi';

interface PreferencesContextValue {
  preferences: NotificationPreferences;
  loaded: boolean;
  saving: boolean;
  error: string | null;
  reload: () => void;
  update: (key: keyof NotificationPreferences, value: boolean) => Promise<boolean>;
}

const PreferencesContext = createContext<PreferencesContextValue>({
  preferences: defaultNotificationPreferences, loaded: false, saving: false, error: null,
  reload: () => {}, update: async () => false,
});

export function NotificationPreferencesProvider({ children }: PropsWithChildren) {
  const { token } = useAuth();
  const [session, setSession] = useState<{ token: string | null; preferences: NotificationPreferences; loaded: boolean; error: string | null }>({
    token: null, preferences: defaultNotificationPreferences, loaded: false, error: null,
  });
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const activeToken = useRef(token);
  useLayoutEffect(() => { activeToken.current = token; }, [token]);
  const pending = useRef(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    pending.current = false;
    setSaving(false);
    if (token) {
      void (async () => {
        try {
          const response = await getNotificationPreferences({ Authorization: `Bearer ${token}` }, current.signal);
          if (!response.ok) throw new Error();
          const preferences = await response.json();
          if (!current.signal.aborted) setSession({ token, preferences, loaded: true, error: null });
        } catch {
          if (!current.signal.aborted) setSession({ token, preferences: defaultNotificationPreferences, loaded: false,
            error: 'Nie udało się pobrać preferencji. Spróbuj ponownie.' });
        }
      })();
    }
    return () => current.abort();
  }, [token, attempt]);

  const update = useCallback(async (key: keyof NotificationPreferences, value: boolean) => {
    if (!token || activeToken.current !== token || session.token !== token || !session.loaded || pending.current) return false;
    pending.current = true;
    setSaving(true);
    const current = controller.current;
    try {
      const response = await saveNotificationPreferences({ ...session.preferences, [key]: value },
        { Authorization: `Bearer ${token}` }, current?.signal);
      if (!response.ok) throw new Error();
      const preferences = await response.json();
      if (current?.signal.aborted || activeToken.current !== token) return false;
      setSession({ token, preferences, loaded: true, error: null });
      return true;
    } catch {
      if (!current?.signal.aborted && activeToken.current === token) setSession(previous => ({ ...previous,
        error: 'Nie udało się zapisać zmiany. Poprzednie ustawienie zostało zachowane.' }));
      return false;
    } finally {
      if (!current?.signal.aborted && activeToken.current === token) {
        pending.current = false;
        setSaving(false);
      }
    }
  }, [token, session]);

  const current = token && session.token === token;
  return <PreferencesContext.Provider value={{
    preferences: current ? session.preferences : defaultNotificationPreferences,
    loaded: !!current && session.loaded, saving, error: current ? session.error : null,
    reload: () => setAttempt(previous => previous + 1), update,
  }}>{children}</PreferencesContext.Provider>;
}

export function useNotificationPreferences() {
  return useContext(PreferencesContext);
}
