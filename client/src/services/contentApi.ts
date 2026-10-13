import API_URL from '../apiConfig';
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
export class ContentError extends Error {
  fields: FieldErrors;
  constructor(message: string, fields: FieldErrors = {}) { super(message); this.fields = fields; }
}
export async function contentRequest<T>(path: string, token: string | null, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}/api/admin/content${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, ...options.headers } });
  const body = await response.json();
  if (!response.ok) throw new ContentError(body.message || body.detail || 'Nie udało się zapisać materiału.', body.fields ?? {});
  return body as T;
}
function multipart(data: unknown, file: File | null) {
  const body = new FormData();
  body.append('content', new Blob([JSON.stringify(data)], { type: 'application/json' }));
  if (file) body.append('file', file);
  return body;
}
export function savePath(id: number | null, data: PathSave, file: File | null, token: string | null) {
  return contentRequest<PathAdminDetailDto>(id === null ? '/paths' : `/paths/${id}`, token, { method: id === null ? 'POST' : 'PUT', body: multipart(data, file) });
}
export function importPath(file: File, token: string | null) {
  const body = new FormData();
  body.append('file', file);
  return contentRequest<PathAdminDetailDto>('/paths/import', token, { method: 'POST', body });
}
export function saveRoom(id: number | null, data: RoomSave, file: File | null, token: string | null) {
  return contentRequest<RoomEditor>(id === null ? '/rooms' : `/rooms/${id}`, token, { method: id === null ? 'POST' : 'PUT', body: multipart(data, file) });
}
