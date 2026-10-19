import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import { useNotificationPreferences } from '../context/NotificationPreferencesContext';
import './RealtimeNotifications.css';

interface Alert {
  id: string;
  category: 'friendRequests' | 'challenges' | 'matchFound' | 'friendOnline';
  title: string;
  body: string;
  friendId?: number;
  username?: string;
}

interface Toast {
  id: number;
  text: string;
}

export const ONLINE_TOAST_COOLDOWN_MS = 10 * 60 * 1000;
export const TOAST_DURATION_MS = 5000;
const ONLINE_EVENT_PREFIX = 'online:';

export function describeFriendsOnline(usernames: string[]) {
  if (usernames.length === 1) return `${usernames[0]} jest online`;
  if (usernames.length === 2) return `${usernames[0]} i ${usernames[1]} są online`;
  return `${usernames[0]} i ${usernames.length - 1} innych znajomych są online`;
}

export default function RealtimeNotifications() {
  const { token } = useAuth();
  const { state } = useRealtime();
  const { preferences, loaded } = useNotificationPreferences();
  const seen = useRef<{ token: string | null; stream: string; ids: Set<string>; offlineFriends: Set<number>;
    pending: Map<string, Alert> } | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const lastOnlineToast = useRef(new Map<number, number>());
  const nextToastId = useRef(0);
  const toastTimers = useRef(new Map<number, number>());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = (id: number) => {
    window.clearTimeout(toastTimers.current.get(id));
    toastTimers.current.delete(id);
    setToasts(current => current.filter(toast => toast.id !== id));
  };

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
    const events: Alert[] = [
      ...state.friendRequests.map(request => ({ id: `friend:${request.id}`, category: 'friendRequests' as const,
        title: 'Zaproszenie do znajomych', body: `${request.requesterUsername} chce dodać Cię do znajomych.` })),
      ...state.challenges.map(challenge => ({ id: `challenge:${challenge.id}`, category: 'challenges' as const,
        title: 'Wyzwanie w Arenie', body: `${challenge.challengerUsername} zaprasza Cię do pojedynku.` })),
      ...(state.gameSession?.status === 'ACTIVE' ? [{ id: `match:${state.gameSession.id}`,
        category: 'matchFound' as const, title: 'Mecz jest gotowy', body: 'Znaleźliśmy przeciwnika. Twój pojedynek zaraz się rozpocznie.' }] : []),
      ...state.friends.filter(friend => friend.online).map(friend => ({ id: `${ONLINE_EVENT_PREFIX}${friend.id}`,
        category: 'friendOnline' as const, title: 'Znajomy online', body: `${friend.username} jest online.`,
        friendId: friend.id, username: friend.username })),
    ];
    const offlineFriends = new Set(state.friends.filter(friend => !friend.online).map(friend => friend.id));
    if (!seen.current || seen.current.token !== token || seen.current.stream !== state.streamId) {
      seen.current = { token, stream: state.streamId, ids: new Set(events.map(event => event.id)), offlineFriends, pending: new Map() };
      return;
    }
    const history = seen.current;
    events.forEach(event => {
      const cameOnline = event.friendId === undefined || history.offlineFriends.has(event.friendId);
      if (!history.ids.has(event.id) && cameOnline) history.pending.set(event.id, event);
      history.ids.add(event.id);
    });
    history.offlineFriends = offlineFriends;
    const activeIds = new Set(events.map(event => event.id));
    history.pending.forEach((_event, id) => { if (!activeIds.has(id)) history.pending.delete(id); });
    history.ids.forEach(id => { if (id.startsWith(ONLINE_EVENT_PREFIX) && !activeIds.has(id)) history.ids.delete(id); });
    if (!loaded) return;
    const now = Date.now();
    const eligible = [...history.pending.values()].filter(event => preferences[event.category]
      && (event.friendId === undefined || now - (lastOnlineToast.current.get(event.friendId) ?? -Infinity) >= ONLINE_TOAST_COOLDOWN_MS));
    history.pending.clear();
    const online = eligible.filter(event => event.friendId !== undefined);
    online.forEach(event => lastOnlineToast.current.set(event.friendId!, now));
    const onlineSummary = online.length ? describeFriendsOnline(online.map(event => event.username!)) : null;
    if (onlineSummary) {
      const id = nextToastId.current++;
      setToasts(current => [...current, { id, text: onlineSummary }]);
      toastTimers.current.set(id, window.setTimeout(() => dismiss(id), TOAST_DURATION_MS));
    }
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
      const notifications = [...eligible.filter(event => event.friendId === undefined),
        ...(onlineSummary ? [{ id: `${ONLINE_EVENT_PREFIX}${online.map(event => event.friendId).join(',')}`,
          title: online.length === 1 ? 'Znajomy online' : 'Znajomi online', body: `${onlineSummary}.` }] : [])];
      notifications.forEach(event => {
        try {
          const notification = new Notification(event.title, { body: event.body, tag: event.id });
          notification.onclick = () => { window.focus(); notification.close(); };
        } catch { return; }
      });
    }
  }, [state, token, preferences, loaded]);

  useEffect(() => {
    const timers = toastTimers.current;
    return () => {
      timers.forEach(timer => window.clearTimeout(timer));
      timers.clear();
      setToasts([]);
    };
  }, [token]);

  return <div className="realtime-toasts" role="status" aria-live="polite">
    {toasts.map(toast => <div key={toast.id} className="realtime-toast">
      <span className="realtime-toast-dot" aria-hidden="true" />
      <span>{toast.text}</span>
      <button type="button" className="realtime-toast-close" aria-label="Zamknij powiadomienie"
        onClick={() => dismiss(toast.id)}>
        <i className="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>)}
  </div>;
}
