import { useEffect, useState } from 'react';
import * as pathApi from '../services/pathApi';
import type { PathDetailDto, RoomSummaryDto } from '../types/api';

export interface RoomPathProgress {
  title: string;
  currentId: number;
  chapters: { title: string; rooms: { id: number; title: string; solved: boolean }[] }[];
}

export interface RoomReturn {
  to: string;
  label: string;
  title: string;
  pending: boolean;
  next?: { to: string; title: string } | null;
  path?: RoomPathProgress;
}

function pathProgress(path: PathDetailDto, currentId: number): RoomPathProgress {
  const seen = new Set<number>();
  const pick = (rooms: RoomSummaryDto[] = []) => rooms
    .filter(room => !seen.has(room.id) && seen.add(room.id))
    .map(room => ({ id: room.id, title: room.title, solved: room.solved }));
  const chapters = (path.chapters ?? []).map(chapter => ({ title: chapter.title, rooms: pick(chapter.rooms) }));
  const loose = pick(path.rooms);
  if (loose.length > 0) chapters.push({ title: path.title, rooms: loose });
  return { title: path.title, currentId, chapters: chapters.filter(chapter => chapter.rooms.length > 0) };
}

const LEARN_RETURN: RoomReturn = { to: '/learn', label: 'Wróć do nauki', title: 'Nauka', pending: false };
const DASHBOARD_RETURN: RoomReturn = { to: '/dashboard', label: 'Wróć do dashboardu', title: 'Dashboard', pending: false };

function pathRooms(path: PathDetailDto): RoomSummaryDto[] {
  const rooms = [...(path.chapters ?? []).flatMap(chapter => chapter.rooms ?? []), ...(path.rooms ?? [])];
  return rooms.filter((room, index) => rooms.findIndex(other => other.id === room.id) === index);
}

function pathReturn(path: PathDetailDto, roomId: string): RoomReturn | null {
  const rooms = pathRooms(path);
  const index = rooms.findIndex(room => String(room.id) === roomId);
  if (index < 0) return null;
  const next = rooms[index + 1];
  return {
    to: `/learn/paths/${path.id}`,
    label: `Wróć do ścieżki: ${path.title}`,
    title: path.title,
    pending: false,
    next: next && !next.locked ? { to: `/rooms/${next.id}?pathId=${path.id}`, title: next.title } : null,
    path: pathProgress(path, rooms[index].id),
  };
}

export function useRoomReturn(roomId: string | undefined, search: string, sessionKey: string | null, solved = false): RoomReturn {
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
      if (controller.signal.aborted) return;
      setResolved(previous => value === null && previous?.key === key && previous.value ? previous : { key, value });
    };
    pathApi.getPath(pathId, { sessionKey }, controller.signal)
      .then(async response => {
        if (!response.ok) return settle(null);
        settle(pathReturn(await response.json(), roomId));
      })
      .catch(() => settle(null));
    return () => controller.abort();
  }, [pathId, roomId, sessionKey, key, solved]);

  if (!pathId) return fallback;
  if (resolved?.key !== key) return { ...fallback, label: 'Powrót', title: 'Powrót', pending: true };
  return resolved.value ?? fallback;
}
