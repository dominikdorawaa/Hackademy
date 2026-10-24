import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import { useNotificationPreferences } from '../context/NotificationPreferencesContext';
import { loudestEvent, playSound, unlockAudio } from '../lib/notificationSounds';
import type { SoundEvent } from '../lib/notificationSounds';
import type { RealtimeState } from '../types/realtime';
import './RealtimeNotifications.css';

interface Alert {
  id: string;
  category: SoundEvent;
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

function closedChallengeIds(state: RealtimeState) {
  return new Set([...state.expiredChallenges, ...state.rejectedChallenges].map(challenge => challenge.id));
}

export default function RealtimeNotifications() {
  const { sessionKey } = useAuth();
  const { state, connected } = useRealtime();
  const { preferences, loaded } = useNotificationPreferences();
  const seen = useRef<{ sessionKey: string | null; stream: string; ids: Set<string>; offlineFriends: Set<number>;
    pending: Map<string, Alert>; closed: Set<string>; staleState: RealtimeState | null } | null>(null);
  const lastOnlineToast = useRef(new Map<number, number>());
  const nextToastId = useRef(0);
  const toastTimers = useRef(new Map<number, number>());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => {
    window.clearTimeout(toastTimers.current.get(id));
    toastTimers.current.delete(id);
    setToasts(current => current.filter(toast => toast.id !== id));
  }, []);
  const showToast = useCallback((text: string) => {
    const id = nextToastId.current++;
    setToasts(current => [...current, { id, text }]);
    toastTimers.current.set(id, window.setTimeout(() => dismiss(id), TOAST_DURATION_MS));
  }, [dismiss]);

  useEffect(() => {
    if (!preferences.sound || !sessionKey) return;
    const unlock = () => { void unlockAudio(); };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, [preferences.sound, sessionKey]);

  useEffect(() => {
    if (!state || !sessionKey) {
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
    if (!seen.current || seen.current.sessionKey !== sessionKey || seen.current.stream !== state.streamId) {
      seen.current = { sessionKey, stream: state.streamId, ids: new Set(events.map(event => event.id)), offlineFriends, pending: new Map(),
        closed: closedChallengeIds(state), staleState: null };
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
    const missed = history.staleState !== null;
    const closed = missed ? [] : [
      ...state.expiredChallenges.map(challenge => ({ id: challenge.id, text: `Wyzwanie dla ${challenge.targetUsername} wygasło bez odpowiedzi.` })),
      ...state.rejectedChallenges.map(challenge => ({ id: challenge.id, text: `Wyzwanie dla ${challenge.targetUsername} zostało odrzucone.` })),
    ].filter(notice => !history.closed.has(notice.id));
    if (history.staleState !== state) {
      history.closed = closedChallengeIds(state);
      history.staleState = null;
    }
    if (preferences.challenges) closed.forEach(notice => showToast(notice.text));
    const now = Date.now();
    const eligible = [...history.pending.values()].filter(event => preferences[event.category]
      && (event.friendId === undefined || now - (lastOnlineToast.current.get(event.friendId) ?? -Infinity) >= ONLINE_TOAST_COOLDOWN_MS));
    history.pending.clear();
    const online = eligible.filter(event => event.friendId !== undefined);
    online.forEach(event => lastOnlineToast.current.set(event.friendId!, now));
    const onlineSummary = online.length ? describeFriendsOnline(online.map(event => event.username!)) : null;
    if (onlineSummary) showToast(onlineSummary);
    const signal = loudestEvent(eligible.map(event => event.category));
    if (signal && preferences.sound) playSound(signal);
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
  }, [state, sessionKey, preferences, loaded, showToast]);

  useEffect(() => {
    if (!connected && seen.current) seen.current.staleState = state;
  }, [connected, state]);

  useEffect(() => {
    const timers = toastTimers.current;
    return () => {
      timers.forEach(timer => window.clearTimeout(timer));
      timers.clear();
      setToasts([]);
    };
  }, [sessionKey]);

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
