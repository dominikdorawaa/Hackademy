import { request } from './http';
import type { SessionScope } from './http';
import type { ApiId, PathMetaRequest, CreatePathRequest, ChatMessage, PathSummaryDto, PathAdminDetailDto, RoomAdminSummaryDto, RoomAdminDto, RoomWriteRequest } from '../types/api';

export function getRooms(auth: SessionScope) {
  return request<RoomAdminSummaryDto[]>(`/api/admin/rooms`, {
    method: 'GET',
    auth,
  });
}

export function getPaths(auth: SessionScope) {
  return request<PathSummaryDto[]>(`/api/admin/paths`, {
    method: 'GET',
    auth,
  });
}

export function getPath(id: ApiId, auth: SessionScope) {
  return request<PathAdminDetailDto>(`/api/admin/paths/${id}`, {
    method: 'GET',
    auth,
  });
}

export function createPath(data: CreatePathRequest, auth: SessionScope) {
  return request<PathSummaryDto>(`/api/admin/paths`, {
    method: 'POST',
    auth,
    body: JSON.stringify(data),
  });
}

export function deletePath(id: ApiId, auth: SessionScope) {
  return request<void>(`/api/admin/paths/${id}`, {
    method: 'DELETE',
    auth,
  });
}

export function updatePath(id: ApiId, data: PathMetaRequest, auth: SessionScope) {
  return request<void>(`/api/admin/paths/${id}`, {
    method: 'PUT',
    auth,
    body: JSON.stringify(data),
  });
}

export function uploadBanner(id: ApiId, file: File, auth: SessionScope) {
  const data = new FormData();
  data.append('file', file);
  return request<void>(`/api/admin/paths/${id}/banner`, {
    method: 'PUT',
    auth,
    body: data,
  });
}

export function getReports(auth: SessionScope) {
  return request<ChatMessage[]>(`/api/admin/reports`, {
    method: 'GET',
    auth,
  });
}

export function deleteReport(id: ApiId, auth: SessionScope) {
  return request<void>(`/api/admin/reports/${id}`, {
    method: 'DELETE',
    auth,
  });
}

export function dismissReport(id: ApiId, auth: SessionScope) {
  return request<void>(`/api/admin/reports/${id}/dismiss`, {
    method: 'POST',
    auth,
  });
}

export function muteUser(id: ApiId, data: { duration: number }, auth: SessionScope) {
  return request<void>(`/api/admin/users/${id}/mute`, {
    method: 'POST',
    auth,
    body: JSON.stringify(data),
  });
}

function roomFormData(room: RoomWriteRequest, file: File | null): FormData {
  const data = new FormData();
  data.append('room', new Blob([JSON.stringify(room)], { type: 'application/json' }));
  if (file) data.append('file', file);
  return data;
}

export function createRoom(room: RoomWriteRequest, file: File | null, auth: SessionScope) {
  return request<RoomAdminDto>(`/api/admin/rooms`, {
    method: 'POST',
    auth,
    body: roomFormData(room, file),
  });
}

export function updateRoom(id: ApiId, room: RoomWriteRequest, file: File | null, auth: SessionScope) {
  return request<RoomAdminDto>(`/api/admin/rooms/${id}`, {
    method: 'PUT',
    auth,
    body: roomFormData(room, file),
  });
}
