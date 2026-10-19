import { request } from './http';
import type { ChapterRequest, PathAdminDetailDto, PathUnlockMode, RoomAdminDto, RoomTasksAdminDto, RoomTaskRequest, RoomWriteRequest } from '../types/api';
import type { FieldErrors } from '../components/admin/ContentFields';

export interface PathSave {
  revision: number; chaptersRevision: number; title: string; description: string; bannerUrl: string | null;
  published: boolean; chapters: ChapterRequest[]; unlockMode: PathUnlockMode;
}
export interface RoomSave extends RoomWriteRequest {
  revision: number; tasksRevision: number; published: boolean; tasks: RoomTaskRequest[]; hints: string[];
  pathId?: number; chapterId?: number; pathRevision?: number; parentDraft?: PathSave; chapterIndex?: number;
}
export interface RoomEditor { room: RoomAdminDto; tasks: RoomTasksAdminDto; pathId?: number | null }
export interface RoomImportTarget { chapterId: number; contentRevision: number; chaptersRevision: number }
export interface CtfImportResult { roomIds: number[]; count: number }
export class ContentError extends Error {
  fields: FieldErrors;
  constructor(message: string, fields: FieldErrors = {}) { super(message); this.fields = fields; }
}
export async function contentRequest<T>(path: string, sessionKey: string | null, options: RequestInit = {}): Promise<T> {
  const response = await request<T, { message?: string; detail?: string; fields?: FieldErrors }>(`/api/admin/content${path}`, { ...options, auth: { sessionKey } });
  if (!response.ok) { const body = await response.json(); throw new ContentError(body.message || body.detail || 'Nie udało się zapisać materiału.', body.fields ?? {}); }
  return response.json();
}
function multipart(data: unknown, file: File | null) {
  const body = new FormData();
  body.append('content', new Blob([JSON.stringify(data)], { type: 'application/json' }));
  if (file) body.append('file', file);
  return body;
}
export function savePath(id: number | null, data: PathSave, file: File | null, sessionKey: string | null) {
  return contentRequest<PathAdminDetailDto>(id === null ? '/paths' : `/paths/${id}`, sessionKey, { method: id === null ? 'POST' : 'PUT', body: multipart(data, file) });
}
export function importPath(file: File, sessionKey: string | null) {
  const body = new FormData();
  body.append('file', file);
  return contentRequest<PathAdminDetailDto>('/paths/import', sessionKey, { method: 'POST', body });
}
export function importCtfRooms(file: File, sessionKey: string | null) {
  const body = new FormData(); body.append('file', file);
  return contentRequest<CtfImportResult>('/ctf/import', sessionKey, { method: 'POST', body });
}
export function importPathRooms(id: number, target: RoomImportTarget, file: File, sessionKey: string | null) {
  const body = new FormData();
  body.append('target', new Blob([JSON.stringify(target)], { type: 'application/json' }));
  body.append('file', file);
  return contentRequest<PathAdminDetailDto>(`/paths/${id}/rooms/import`, sessionKey, { method: 'POST', body });
}
export function saveRoom(id: number | null, data: RoomSave, file: File | null, sessionKey: string | null) {
  return contentRequest<RoomEditor>(id === null ? '/rooms' : `/rooms/${id}`, sessionKey, { method: id === null ? 'POST' : 'PUT', body: multipart(data, file) });
}
