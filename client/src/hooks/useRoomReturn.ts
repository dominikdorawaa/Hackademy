import { useEffect, useState } from 'react';
import * as pathApi from '../services/pathApi';
import type { PathDetailDto } from '../types/api';

export interface RoomReturn {
  to: string;
  label: string;
  pending: boolean;
}

const LEARN_RETURN: RoomReturn = { to: '/learn', label: 'Wróć do nauki', pending: false };
const DASHBOARD_RETURN: RoomReturn = { to: '/dashboard', label: 'Wróć do dashboardu', pending: false };

function pathContainsRoom(path: PathDetailDto, roomId: string): boolean {
  const rooms = [...(path.rooms ?? []), ...(path.chapters ?? []).flatMap(chapter => chapter.rooms ?? [])];
  return rooms.some(room => String(room.id) === roomId);
}

export function useRoomReturn(roomId: string | undefined, search: string, sessionKey: string | null): RoomReturn {
  const params = new URLSearchParams(search);
  const rawPathId = params.get('pathId');
  const pathId = rawPathId && /^\d+$/.test(rawPathId) && roomId && sessionKey ? rawPathId : null;
  const fallback = params.get('from') === 'dashboard' ? DASHBOARD_RETURN : LEARN_RETURN;
  const key = `${pathId}|${roomId}|${sessionKey}`;
  const [resolved, setResolved] = useState<{ key: string; value: RoomReturn | null } | null>(null);

  useEffect(() => {
    if (!pathId || !roomId) return;
    const controller = new AbortController();
    const settle = (value: RoomReturn | null) => {
      if (!controller.signal.aborted) setResolved({ key, value });
    };
    pathApi.getPath(pathId, { sessionKey }, controller.signal)
      .then(async response => {
        if (!response.ok) return settle(null);
        const path = await response.json();
        settle(pathContainsRoom(path, roomId)
          ? { to: `/learn/paths/${path.id}`, label: `Wróć do ścieżki: ${path.title}`, pending: false }
          : null);
      })
      .catch(() => settle(null));
    return () => controller.abort();
  }, [pathId, roomId, sessionKey, key]);

  if (!pathId) return fallback;
  if (resolved?.key !== key) return { ...fallback, label: 'Powrót', pending: true };
  return resolved.value ?? fallback;
}
