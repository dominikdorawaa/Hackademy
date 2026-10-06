import { request } from './http';
import type { ApiId, PathRoomsMiniResponse, PathSummaryDto, PathProgressDto } from '../types/api';

export function getProgress(headers: HeadersInit) {
  return request<PathProgressDto[]>(`/api/paths/me/progress`, {
    method: 'GET',
    headers,
  });
}

export function getPaths(headers: HeadersInit) {
  return request<PathSummaryDto[]>(`/api/paths`, {
    method: 'GET',
    headers,
  });
}

export function getRoomsMini(id: ApiId, limit: number, headers: HeadersInit) {
  return request<PathRoomsMiniResponse>(`/api/paths/${id}/rooms-mini?limit=${limit}`, {
    method: 'GET',
    headers,
  });
}

export function enroll(id: ApiId, headers: HeadersInit) {
  return request<void>(`/api/paths/${id}/enroll`, {
    method: 'POST',
    headers,
  });
}

