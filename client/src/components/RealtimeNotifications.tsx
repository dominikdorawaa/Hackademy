import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import { useNotificationPreferences } from '../context/NotificationPreferencesContext';
import { loudestEvent, playSound, unlockAudio } from '../lib/notificationSounds';
import type { SoundEvent } from '../lib/notificationSounds';
import type { RealtimeState } from '../types/realtime';
import { Bell } from '@phosphor-icons/react';
import InvitationCard from './InvitationCard';
import type { AvatarConfig } from '../types/api';
import * as friendApi from '../services/friendApi';
import * as arenaApi from '../services/arenaApi';
import './RealtimeNotifications.css';

interface Alert {
  id: string;
  category: SoundEvent;
  title: string;
  body: string;
  friendId?: number;
  username?: string;
  actor?: string;
  targetId?: number | string;
  avatar?: AvatarConfig | null;
  elo?: number | null;
  ownElo?: number | null;
}

type ToastKind = 'info' | 'friend' | 'challenge' | 'summary';

interface Toast {
  id: number;
  text: string;
  kind: ToastKind;
  actor?: string;
  targetId?: number | string;
  avatar?: AvatarConfig | null;
  elo?: number | null;
  ownElo?: number | null;
  busy?: boolean;
  failed?: boolean;
  paused?: boolean;
  duration: number;
  /** How many invitations a summary toast stands for. */
  count?: number;
}



export const ONLINE_TOAST_COOLDOWN_MS = 10 * 60 * 1000;
export const TOAST_DURATION_MS = 5000;
/** A duel needs a decision, so its toast stays three times longer than the rest. */
export const CHALLENGE_TOAST_DURATION_MS = 15000;
const ONLINE_EVENT_PREFIX = 'online:';
const ACCEPTED_EVENT_PREFIX = 'accepted:';

export function describeFriendsOnline(usernames: string[]) {
  if (usernames.length === 1) return `${usernames[0]} jest online`;
  if (usernames.length === 2) return `${usernames[0]} i ${usernames[1]} są online`;
  return `${usernames[0]} i ${usernames.length - 1} innych znajomych są online`;
}

export function describeInvitations(count: number) {
  const few = count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14);
  return `Masz ${count} ${few ? 'nowe zaproszenia' : 'nowych zaproszeń'}. Znajdziesz je w dzwonku`;
}

function currentAvatar(toast: Toast, state: RealtimeState | null) {
  if (toast.kind === 'friend') {
    const request = state?.friendRequests.find(entry => entry.id === toast.targetId);
    return request ? request.avatar : toast.avatar;
  }
  const challenge = state?.challenges.find(entry => entry.id === toast.targetId);
  return challenge ? challenge.challengerAvatar : toast.avatar;
}

export default function RealtimeNotifications() {
  const { sessionKey, user } = useAuth();
  const { state, connected, synchronize } = useRealtime();
  const { preferences, loaded } = useNotificationPreferences();
  const seen = useRef<{ sessionKey: string | null; stream: string; ids: Set<string>; offlineFriends: Set<number>;
    friends: Set<number>; requesters: Set<string>;
    pending: Map<string, Alert>; expired: Set<string>; staleState: RealtimeState | null } | null>(null);
  const lastOnlineToast = useRef(new Map<number, number>());
  const nextToastId = useRef(0);
  const toastTimers = useRef(new Map<number, number>());
  const toastClock = useRef(new Map<number, { deadline: number; remaining: number }>());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const visibleToasts = useRef<Toast[]>([]);
  useEffect(() => { visibleToasts.current = toasts; }, [toasts]);
  // Toasts whose answer is still being sent: their countdown stays held so a slow request cannot lose them.
  const answering = useRef(new Set<number>());
  const dismiss = useCallback((id: number) => {
    window.clearTimeout(toastTimers.current.get(id));
    toastTimers.current.delete(id);
    toastClock.current.delete(id);
    answering.current.delete(id);
    setToasts(current => current.filter(toast => toast.id !== id));
  }, []);
  const schedule = useCallback((id: number, delay: number) => {
    toastClock.current.set(id, { deadline: Date.now() + delay, remaining: delay });
    toastTimers.current.set(id, window.setTimeout(() => dismiss(id), delay));
  }, [dismiss]);
  const showToast = useCallback((text: string, details: Omit<Toast, 'id' | 'text' | 'kind' | 'duration'> & { kind?: ToastKind } = {}) => {
    const id = nextToastId.current++;
    const duration = details.kind === 'challenge' ? CHALLENGE_TOAST_DURATION_MS : TOAST_DURATION_MS;
    setToasts(current => [...current, { kind: 'info', ...details, id, text, duration }]);
    schedule(id, duration);
  }, [schedule]);
  const update = useCallback((id: number, change: Partial<Toast>) => setToasts(current => current.map(toast => toast.id === id ? { ...toast, ...change } : toast)), []);
  // Hovering or focusing a toast holds the countdown, so there is time to read it and press a button.
  const pause = useCallback((id: number) => {
    const clock = toastClock.current.get(id);
    if (!clock || !toastTimers.current.has(id)) return;
    window.clearTimeout(toastTimers.current.get(id));
    toastTimers.current.delete(id);
    toastClock.current.set(id, { ...clock, remaining: Math.max(0, clock.deadline - Date.now()) });
    update(id, { paused: true });
  }, [update]);
  const resume = useCallback((id: number, element?: Element | null) => {
    const clock = toastClock.current.get(id);
    if (!clock || toastTimers.current.has(id) || answering.current.has(id) || element?.matches(':hover, :focus-within')) return;
    toastClock.current.set(id, { deadline: Date.now() + clock.remaining, remaining: clock.remaining });
    toastTimers.current.set(id, window.setTimeout(() => dismiss(id), clock.remaining));
    update(id, { paused: false });
  }, [dismiss, update]);
  const respond = async (toast: Toast, accept: boolean) => {
    if (toast.busy || toast.targetId === undefined || !sessionKey) return;
    answering.current.add(toast.id);
    pause(toast.id);
    update(toast.id, { busy: true, failed: false });
    try {
      const response = toast.kind === 'friend'
        ? await (accept ? friendApi.acceptRequest : friendApi.rejectRequest)(toast.targetId, { sessionKey })
        : await (accept ? arenaApi.acceptChallenge : arenaApi.rejectChallenge)(toast.targetId, { sessionKey });
      if (!response.ok) throw new Error('Invitation response failed');
      dismiss(toast.id);
      await synchronize();
    } catch {
      answering.current.delete(toast.id);
      update(toast.id, { busy: false, failed: true });
      resume(toast.id, document.querySelector(`[data-toast-id="${toast.id}"]`));
    }
  };

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
        title: 'Zaproszenie do znajomych', body: `${request.requesterUsername} chce dodać Cię do znajomych.`,
        actor: request.requesterUsername, targetId: request.id, avatar: request.avatar })),
      ...state.challenges.map(challenge => ({ id: `challenge:${challenge.id}`, category: 'challenges' as const,
        title: 'Wyzwanie w Arenie', body: `${challenge.challengerUsername} zaprasza Cię do pojedynku.`,
        actor: challenge.challengerUsername, targetId: challenge.id, avatar: challenge.challengerAvatar,
        elo: challenge.challengerElo, ownElo: challenge.targetElo })),
      ...(state.gameSession?.status === 'ACTIVE' ? [{ id: `match:${state.gameSession.id}`,
        category: 'matchFound' as const, title: 'Mecz jest gotowy', body: 'Znaleźliśmy przeciwnika. Twój pojedynek zaraz się rozpocznie.' }] : []),
      ...state.friends.filter(friend => friend.online).map(friend => ({ id: `${ONLINE_EVENT_PREFIX}${friend.id}`,
        category: 'friendOnline' as const, title: 'Znajomy online', body: `${friend.username} jest online.`,
        friendId: friend.id, username: friend.username })),
    ];
    const offlineFriends = new Set(state.friends.filter(friend => !friend.online).map(friend => friend.id));
    const friends = new Set(state.friends.map(friend => friend.id));
    const requesters = new Set(state.friendRequests.map(request => request.requesterUsername));
    if (!seen.current || seen.current.sessionKey !== sessionKey || seen.current.stream !== state.streamId) {
      seen.current = { sessionKey, stream: state.streamId, ids: new Set(events.map(event => event.id)), offlineFriends, friends, requesters,
        pending: new Map(), expired: new Set(state.expiredChallenges.map(challenge => challenge.id)), staleState: null };
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
    history.pending.forEach((_event, id) => { if (!activeIds.has(id) && !id.startsWith(ACCEPTED_EVENT_PREFIX)) history.pending.delete(id); });
    history.ids.forEach(id => { if (id.startsWith(ONLINE_EVENT_PREFIX) && !activeIds.has(id)) history.ids.delete(id); });
    // A new friend who had not invited the viewer accepted the viewer's own invitation.
    state.friends.filter(friend => !history.friends.has(friend.id) && !history.requesters.has(friend.username)).forEach(friend =>
      history.pending.set(`${ACCEPTED_EVENT_PREFIX}${friend.id}`, { id: `${ACCEPTED_EVENT_PREFIX}${friend.id}`, category: 'friendRequests',
        title: 'Zaproszenie przyjęte', body: `${friend.username} przyjmuje Twoje zaproszenie do znajomych.` }));
    history.friends = friends;
    history.requesters = requesters;
    if (!loaded) return;
    const missed = history.staleState !== null;
    const expired = missed ? [] : state.expiredChallenges.filter(challenge => !history.expired.has(challenge.id));
    if (history.staleState !== state) {
      history.expired = new Set(state.expiredChallenges.map(challenge => challenge.id));
      history.staleState = null;
    }
    if (preferences.challenges) expired.forEach(challenge => showToast(`Wyzwanie dla ${challenge.targetUsername} wygasło bez odpowiedzi.`));
    const now = Date.now();
    const eligible = [...history.pending.values()].filter(event => preferences[event.category]
      && (event.friendId === undefined || now - (lastOnlineToast.current.get(event.friendId) ?? -Infinity) >= ONLINE_TOAST_COOLDOWN_MS));
    history.pending.clear();
    const online = eligible.filter(event => event.friendId !== undefined);
    online.forEach(event => lastOnlineToast.current.set(event.friendId!, now));
    const onlineSummary = online.length ? describeFriendsOnline(online.map(event => event.username!)) : null;
    if (onlineSummary) showToast(onlineSummary);
    eligible.filter(event => event.id.startsWith(ACCEPTED_EVENT_PREFIX)).forEach(event => showToast(event.body));
    const invitations = eligible.filter(event => (event.category === 'friendRequests' || event.category === 'challenges') && event.targetId !== undefined);
    // The threshold covers invitation cards already on screen too, so a slow trickle still folds into one summary.
    const shownInvitations = visibleToasts.current.filter(toast => (toast.kind === 'friend' || toast.kind === 'challenge' || toast.kind === 'summary')
      && !answering.current.has(toast.id));
    const total = invitations.length ? shownInvitations.reduce((sum, toast) => sum + (toast.count ?? 1), invitations.length) : 0;
    if (total > 2) {
      shownInvitations.forEach(toast => dismiss(toast.id));
      showToast(describeInvitations(total), { kind: 'summary', count: total });
    } else invitations.forEach(event => showToast(event.body, { kind: event.category === 'friendRequests' ? 'friend' : 'challenge',
      actor: event.actor, targetId: event.targetId, avatar: event.avatar, elo: event.elo, ownElo: event.ownElo }));
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
  }, [state, sessionKey, preferences, loaded, showToast, dismiss]);

  useEffect(() => {
    if (!connected && seen.current) seen.current.staleState = state;
  }, [connected, state]);

  // An invitation answered in the bell or on another device no longer needs its toast.
  useEffect(() => {
    if (!state) return;
    const open = new Set<number | string>([...state.friendRequests.map(request => request.id), ...state.challenges.map(challenge => challenge.id)]);
    toasts.forEach(toast => {
      if ((toast.kind === 'friend' || toast.kind === 'challenge') && !toast.busy && !open.has(toast.targetId!)) dismiss(toast.id);
    });
  }, [state, toasts, dismiss]);

  useEffect(() => {
    const timers = toastTimers.current;
    const clocks = toastClock.current;
    return () => {
      timers.forEach(timer => window.clearTimeout(timer));
      timers.clear();
      clocks.clear();
      setToasts([]);
    };
  }, [sessionKey]);

  return <div className="realtime-toasts" role="status" aria-live="polite">
    {toasts.map(toast => {
      const invitation = toast.kind === 'friend' || toast.kind === 'challenge';
      return <div key={toast.id} className="realtime-toast" data-toast-id={toast.id} data-kind={toast.kind} data-paused={toast.paused || toast.busy || undefined}
        aria-label={invitation ? (toast.kind === 'friend' ? 'Zaproszenie do znajomych' : 'Wyzwanie w Arenie') : undefined}
        role={invitation ? 'group' : undefined}
        style={{ '--toast-duration': `${toast.duration}ms` } as CSSProperties}
        onMouseEnter={() => pause(toast.id)} onFocus={() => pause(toast.id)}
        onMouseLeave={event => resume(toast.id, event.currentTarget)}
        onBlur={event => { const element = event.currentTarget; window.setTimeout(() => resume(toast.id, element)); }}>
        {invitation
          ? <InvitationCard kind={toast.kind as 'friend' | 'challenge'} actor={toast.actor ?? ''} avatar={currentAvatar(toast, state)} elo={toast.elo}
            ownName={user?.username} ownAvatar={user?.avatar} ownElo={toast.ownElo} busy={toast.busy} failed={toast.failed}
            onAccept={() => void respond(toast, true)} onReject={() => void respond(toast, false)} />
          : <>
            {toast.kind === 'summary'
              ? <Bell className="realtime-toast-mark" size={18} weight="fill" aria-hidden="true" />
              : <span className="realtime-toast-dot" aria-hidden="true" />}
            <span>{toast.text}</span>
          </>}
        <button type="button" className="realtime-toast-close" aria-label="Zamknij powiadomienie"
          onClick={() => dismiss(toast.id)}>
          <i className="fas fa-times" aria-hidden="true"></i>
        </button>
        <span className="realtime-toast-timer" aria-hidden="true" />
      </div>;
    })}
  </div>;
}
