import { request } from './http';
import type { ApiId, PathMetaRequest, CreatePathRequest, ChatMessage, PathSummaryDto, PathAdminDetailDto, RoomAdminSummaryDto, RoomAdminDto, RoomWriteRequest } from '../types/api';

export function getRooms(headers: HeadersInit) {
  return request<RoomAdminSummaryDto[]>(`/api/admin/rooms`, {
    method: 'GET',
    headers,
  });
}

export function getPaths(headers: HeadersInit) {
  return request<PathSummaryDto[]>(`/api/admin/paths`, {
    method: 'GET',
    headers,
  });
}

export function getPath(id: ApiId, headers: HeadersInit) {
  return request<PathAdminDetailDto>(`/api/admin/paths/${id}`, {
    method: 'GET',
    headers,
  });
}

export function createPath(data: CreatePathRequest, headers: HeadersInit) {
  return request<PathSummaryDto>(`/api/admin/paths`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
}

export function deletePath(id: ApiId, headers: HeadersInit) {
  return request<void>(`/api/admin/paths/${id}`, {
    method: 'DELETE',
    headers,
  });
}

export function updatePath(id: ApiId, data: PathMetaRequest, headers: HeadersInit) {
  return request<void>(`/api/admin/paths/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
}

export function updatePathRooms(id: ApiId, data: { roomIds: number[] }, headers: HeadersInit) {
  return request<void>(`/api/admin/paths/${id}/rooms`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });
}

export function uploadBanner(id: ApiId, file: File, headers: HeadersInit) {
  const data = new FormData();
  data.append('file', file);
  return request<void>(`/api/admin/paths/${id}/banner`, {
    method: 'PUT',
    headers,
    body: data,
  });
}

export function getReports(headers: HeadersInit) {
  return request<ChatMessage[]>(`/api/admin/reports`, {
    method: 'GET',
    headers,
  });
}

export function deleteReport(id: ApiId, headers: HeadersInit) {
  return request<void>(`/api/admin/reports/${id}`, {
    method: 'DELETE',
    headers,
  });
}

export function dismissReport(id: ApiId, headers: HeadersInit) {
  return request<void>(`/api/admin/reports/${id}/dismiss`, {
    method: 'POST',
    headers,
  });
}

export function muteUser(id: ApiId, data: { duration: number }, headers: HeadersInit) {
  return request<void>(`/api/admin/users/${id}/mute`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
}

function roomFormData(room: RoomWriteRequest, file: File | null): FormData {
  const data = new FormData();
  data.append('room', new Blob([JSON.stringify(room)], { type: 'application/json' }));
  if (file) data.append('file', file);
  return data;
}

export function createRoom(room: RoomWriteRequest, file: File | null, headers: HeadersInit) {
  return request<RoomAdminDto>(`/api/admin/rooms`, {
    method: 'POST',
    headers,
    body: roomFormData(room, file),
  });
}

export function updateRoom(id: ApiId, room: RoomWriteRequest, file: File | null, headers: HeadersInit) {
  return request<RoomAdminDto>(`/api/admin/rooms/${id}`, {
    method: 'PUT',
    headers,
    body: roomFormData(room, file),
  });
}
