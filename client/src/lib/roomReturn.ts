import type { ApiId } from '../types/api';

export type RoomOrigin = { kind: 'path'; pathId: ApiId } | { kind: 'dashboard' };

export function roomHref(roomId: ApiId, origin?: RoomOrigin): string {
  if (origin?.kind === 'dashboard') return `/rooms/${roomId}?from=dashboard`;
  if (origin?.kind === 'path') return `/rooms/${roomId}?pathId=${encodeURIComponent(String(origin.pathId))}`;
  return `/rooms/${roomId}`;
}
