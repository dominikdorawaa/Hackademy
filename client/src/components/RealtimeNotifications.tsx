import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import { useNotificationPreferences } from '../context/NotificationPreferencesContext';

export default function RealtimeNotifications() {
  const { token } = useAuth();
  const { state } = useRealtime();
  const { preferences, loaded } = useNotificationPreferences();
  const seen = useRef<{ token: string | null; stream: string; ids: Set<string> } | null>(null);
  const audio = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!preferences.sound || !token) return;
    const unlock = () => {
      try {
        audio.current ??= new AudioContext();
        void audio.current.resume().catch(() => {});
      } catch { return; }
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
      void audio.current?.close().catch(() => {});
      audio.current = null;
    };
  }, [preferences.sound, token]);

  useEffect(() => {
    if (!state || !token) {
      seen.current = null;
      return;
    }
    const events = [
      ...state.friendRequests.map(request => ({ id: `friend:${request.id}`, enabled: preferences.friendRequests,
        title: 'Zaproszenie do znajomych', body: `${request.requesterUsername} chce dodać Cię do znajomych.` })),
      ...state.challenges.map(challenge => ({ id: `challenge:${challenge.id}`, enabled: preferences.challenges,
        title: 'Wyzwanie w Arenie', body: `${challenge.challengerUsername} zaprasza Cię do pojedynku.` })),
      ...(state.gameSession?.status === 'ACTIVE' ? [{ id: `match:${state.gameSession.id}`,
        enabled: preferences.matchFound, title: 'Mecz jest gotowy', body: 'Znaleźliśmy przeciwnika. Twój pojedynek zaraz się rozpocznie.' }] : []),
    ];
    if (!seen.current || seen.current.token !== token || seen.current.stream !== state.streamId) {
      seen.current = { token, stream: state.streamId, ids: new Set(events.map(event => event.id)) };
      return;
    }
    const fresh = events.filter(event => !seen.current!.ids.has(event.id));
    events.forEach(event => seen.current!.ids.add(event.id));
    if (!loaded) return;
    const eligible = fresh.filter(event => event.enabled);
    if (eligible.length && preferences.sound && audio.current?.state === 'running') {
      const context = audio.current;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 660;
      gain.gain.setValueAtTime(0.07, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.18);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.2);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    }
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
