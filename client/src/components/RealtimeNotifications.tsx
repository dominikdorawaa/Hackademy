import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import { useNotificationPreferences } from '../context/NotificationPreferencesContext';
import { loudestEvent, playSound, unlockAudio } from '../lib/notificationSounds';
import type { SoundEvent } from '../lib/notificationSounds';

interface Alert {
  id: string;
  category: SoundEvent;
  title: string;
  body: string;
}

export default function RealtimeNotifications() {
  const { token } = useAuth();
  const { state } = useRealtime();
  const { preferences, loaded } = useNotificationPreferences();
  const seen = useRef<{ token: string | null; stream: string; ids: Set<string>; pending: Map<string, Alert> } | null>(null);

  useEffect(() => {
    if (!preferences.sound || !token) return;
    const unlock = () => { void unlockAudio(); };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, [preferences.sound, token]);

  useEffect(() => {
    if (!state || !token) {
      seen.current = null;
      return;
    }
    const events: Alert[] = [
      ...state.friendRequests.map(request => ({ id: `friend:${request.id}`, category: 'friendRequests' as const,
        title: 'Zaproszenie do znajomych', body: `${request.requesterUsername} chce dodać Cię do znajomych.` })),
      ...state.challenges.map(challenge => ({ id: `challenge:${challenge.id}`, category: 'challenges' as const,
        title: 'Wyzwanie w Arenie', body: `${challenge.challengerUsername} zaprasza Cię do pojedynku.` })),
      ...(state.gameSession?.status === 'ACTIVE' ? [{ id: `match:${state.gameSession.id}`,
        category: 'matchFound' as const, title: 'Mecz jest gotowy', body: 'Znaleźliśmy przeciwnika. Twój pojedynek zaraz się rozpocznie.' }] : []),
    ];
    if (!seen.current || seen.current.token !== token || seen.current.stream !== state.streamId) {
      seen.current = { token, stream: state.streamId, ids: new Set(events.map(event => event.id)), pending: new Map() };
      return;
    }
    const history = seen.current;
    events.forEach(event => {
      if (!history.ids.has(event.id)) history.pending.set(event.id, event);
      history.ids.add(event.id);
    });
    const activeIds = new Set(events.map(event => event.id));
    history.pending.forEach((_event, id) => { if (!activeIds.has(id)) history.pending.delete(id); });
    if (!loaded) return;
    const eligible = [...history.pending.values()].filter(event => preferences[event.category]);
    history.pending.clear();
    const signal = loudestEvent(eligible.map(event => event.category));
    if (signal && preferences.sound) playSound(signal);
    if (preferences.browserNotifications && document.visibilityState === 'hidden'
      && 'Notification' in window && Notification.permission === 'granted') {
      eligible.forEach(event => {
        try {
          const notification = new Notification(event.title, { body: event.body, tag: event.id });
          notification.onclick = () => { window.focus(); notification.close(); };
        } catch { return; }
      });
    }
  }, [state, token, preferences, loaded]);

  return null;
}
