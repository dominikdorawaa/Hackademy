import { request } from './http';
import type { SessionScope } from './http';
import type { ApiId, PathDetailDto, PathRoomsMiniResponse, PathSummaryDto, PathProgressDto } from '../types/api';

export function getProgress(auth: SessionScope) {
  return request<PathProgressDto[]>(`/api/paths/me/progress`, {
    method: 'GET',
    auth,
  });
}

export function getPaths(auth: SessionScope) {
  return request<PathSummaryDto[]>(`/api/paths`, {
    method: 'GET',
    auth,
  });
}

export function getRoomsMini(id: ApiId, limit: number, auth: SessionScope) {
  return request<PathRoomsMiniResponse>(`/api/paths/${id}/rooms-mini?limit=${limit}`, {
    method: 'GET',
    auth,
  });
}

export function enroll(id: ApiId, auth: SessionScope) {
  return request<void>(`/api/paths/${id}/enroll`, {
    method: 'POST',
    auth,
  });
}


export function getPath(id: ApiId, auth: SessionScope, signal?: AbortSignal) {
  return request<PathDetailDto>(`/api/paths/${id}`, {
    method: 'GET',
    auth,
    signal,
  });
}
