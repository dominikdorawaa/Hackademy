import type { FriendDto } from '../types/api';
import { formatRelativeTimePL } from './relativeTime';

type FriendPresence = Pick<FriendDto, 'online' | 'activity' | 'activityRoom' | 'lastSeenAt'>;

export function friendActivity(friend: FriendPresence, now = Date.now()) {
  if (!friend.online) return friend.lastSeenAt ? `ostatnio online ${formatRelativeTimePL(friend.lastSeenAt, now)}` : null;
  if (friend.activity === 'DUEL') return 'w pojedynku';
  if (friend.activity === 'ARENA_QUEUE') return 'w kolejce Areny';
  if (friend.activity === 'ROOM' && friend.activityRoom) return `rozwiązuje pokój ${friend.activityRoom}`;
  return null;
}

export function friendStatus(friend: FriendPresence, now = Date.now()) {
  return friendActivity(friend, now) ?? (friend.online ? 'online' : 'offline');
}
