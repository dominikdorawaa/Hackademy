import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, useMemo } from 'react';
import type { PropsWithChildren } from 'react';
import { useAuth } from './AuthContext';
import { defaultNotificationPreferences, getNotificationPreferences, saveNotificationPreference } from '../services/userApi';
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
  const { sessionKey } = useAuth();
  const [session, setSession] = useState<{ sessionKey: string | null; preferences: NotificationPreferences; loaded: boolean; error: string | null }>({
    sessionKey: null, preferences: defaultNotificationPreferences, loaded: false, error: null,
  });
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const activeToken = useRef(sessionKey);
  useLayoutEffect(() => { activeToken.current = sessionKey; }, [sessionKey]);
  const pending = useRef(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    pending.current = false;
    setSaving(false);
    if (sessionKey) {
      void (async () => {
        try {
          const response = await getNotificationPreferences({ sessionKey }, current.signal);
          if (!response.ok) throw new Error();
          const preferences = await response.json();
          if (!current.signal.aborted) setSession({ sessionKey, preferences, loaded: true, error: null });
        } catch {
          if (!current.signal.aborted) setSession({ sessionKey, preferences: defaultNotificationPreferences, loaded: false,
            error: 'Nie udało się pobrać preferencji. Spróbuj ponownie.' });
        }
      })();
    }
    return () => current.abort();
  }, [sessionKey, attempt]);

  const update = useCallback(async (key: keyof NotificationPreferences, value: boolean) => {
    if (!sessionKey || activeToken.current !== sessionKey || session.sessionKey !== sessionKey || !session.loaded || pending.current) return false;
    pending.current = true;
    setSaving(true);
    const current = controller.current;
    try {
      const response = await saveNotificationPreference(key, value,
        { sessionKey }, current?.signal);
      if (!response.ok) throw new Error();
      const preferences = await response.json();
      if (current?.signal.aborted || activeToken.current !== sessionKey) return false;
      setSession({ sessionKey, preferences, loaded: true, error: null });
      return true;
    } catch {
      if (!current?.signal.aborted && activeToken.current === sessionKey) setSession(previous => ({ ...previous,
        error: 'Nie udało się zapisać zmiany. Poprzednie ustawienie zostało zachowane.' }));
      return false;
    } finally {
      if (!current?.signal.aborted && activeToken.current === sessionKey) {
        pending.current = false;
        setSaving(false);
      }
    }
  }, [sessionKey, session]);

  const current = sessionKey && session.sessionKey === sessionKey;
  const reload = useCallback(() => setAttempt(previous => previous + 1), []);
  const value = useMemo(() => ({
    preferences: current ? session.preferences : defaultNotificationPreferences,
    loaded: !!current && session.loaded, saving, error: current ? session.error : null,
    reload, update,
  }), [current, session, saving, reload, update]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function useNotificationPreferences() {
  return useContext(PreferencesContext);
}
