import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { useAuth } from './AuthContext';
import { useRealtime } from './RealtimeContext';
import { useNotificationPreferences } from './NotificationPreferencesContext';

export interface FriendOnlineEntry {
  id: string;
  friendId: number;
  username: string;
  at: number;
  read: boolean;
}

interface FriendOnlineFeedValue {
  entries: FriendOnlineEntry[];
  dismiss: (id: string) => void;
  clear: () => void;
  markAllRead: () => void;
}

export const ONLINE_ENTRY_COOLDOWN_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 20;
const NO_ENTRIES: FriendOnlineEntry[] = [];

const FriendOnlineFeedContext = createContext<FriendOnlineFeedValue>({
  entries: [], dismiss: () => {}, clear: () => {}, markAllRead: () => {},
});

// One bell entry per offline→online transition. The first snapshot of a stream is only a baseline,
// so signing in does not flood the bell with everyone who was already online.
export function FriendOnlineFeedProvider({ children }: PropsWithChildren) {
  const { sessionKey } = useAuth();
  const { state } = useRealtime();
  const { preferences } = useNotificationPreferences();
  const [feed, setFeed] = useState<{ sessionKey: string | null; entries: FriendOnlineEntry[] }>({ sessionKey: null, entries: [] });
  const baseline = useRef<{ sessionKey: string | null; stream: string; offline: Set<number> } | null>(null);
  const lastEntry = useRef(new Map<number, number>());

  useEffect(() => {
    if (!state || !sessionKey) {
      baseline.current = null;
      return;
    }
    const offline = new Set(state.friends.filter(friend => !friend.online).map(friend => friend.id));
    const previous = baseline.current;
    baseline.current = { sessionKey, stream: state.streamId, offline };
    if (!previous || previous.sessionKey !== sessionKey || previous.stream !== state.streamId) {
      if (previous?.sessionKey !== sessionKey) lastEntry.current.clear();
      return;
    }
    if (!preferences.friendOnlineBell) return;
    const now = Date.now();
    const cameOnline = state.friends.filter(friend => friend.online && previous.offline.has(friend.id)
      && now - (lastEntry.current.get(friend.id) ?? -Infinity) >= ONLINE_ENTRY_COOLDOWN_MS);
    if (!cameOnline.length) return;
    cameOnline.forEach(friend => lastEntry.current.set(friend.id, now));
    const fresh = cameOnline.map(friend => ({ id: `${friend.id}:${now}`, friendId: friend.id, username: friend.username, at: now, read: false }));
    const replaced = new Set(cameOnline.map(friend => friend.id));
    setFeed(current => ({
      sessionKey,
      entries: [...fresh, ...(current.sessionKey === sessionKey ? current.entries : []).filter(entry => !replaced.has(entry.friendId))]
        .slice(0, MAX_ENTRIES),
    }));
  }, [state, sessionKey, preferences.friendOnlineBell]);

  const update = useCallback((change: (entries: FriendOnlineEntry[]) => FriendOnlineEntry[]) =>
    setFeed(current => ({ ...current, entries: change(current.entries) })), []);
  const dismiss = useCallback((id: string) => update(entries => entries.filter(entry => entry.id !== id)), [update]);
  const clear = useCallback(() => update(() => []), [update]);
  const markAllRead = useCallback(() => update(entries => entries.some(entry => !entry.read)
    ? entries.map(entry => ({ ...entry, read: true })) : entries), [update]);

  const entries = feed.sessionKey === sessionKey && preferences.friendOnlineBell ? feed.entries : NO_ENTRIES;
  const value = useMemo(() => ({ entries, dismiss, clear, markAllRead }), [entries, dismiss, clear, markAllRead]);
  return <FriendOnlineFeedContext.Provider value={value}>{children}</FriendOnlineFeedContext.Provider>;
}

export function useFriendOnlineFeed() {
  return useContext(FriendOnlineFeedContext);
}
