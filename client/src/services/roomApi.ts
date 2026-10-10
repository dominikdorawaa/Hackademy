import { request } from './http';
import type { ApiId, MessageResponse, RoomSummaryDto, RoomDetailDto, SolveRoomResponse } from '../types/api';

export function getRooms(headers: HeadersInit) {
  return request<RoomSummaryDto[]>(`/api/rooms`, {
    method: 'GET',
    headers,
  });
}

export function getRoom(id: ApiId, headers: HeadersInit) {
  return request<RoomDetailDto>(`/api/rooms/${id}`, {
    method: 'GET',
    headers,
  });
}

export function downloadFile(id: ApiId, headers: HeadersInit) {
  return request<never>(`/api/rooms/${id}/file`, {
    method: 'GET',
    headers,
  });
}

export function unlockHint(id: ApiId, hintId: ApiId, headers: HeadersInit) {
  return request<MessageResponse>(`/api/rooms/${id}/hints/${hintId}/unlock`, {
    method: 'POST',
    headers,
  });
}

export function solveTask(id: ApiId, taskId: ApiId, data: { answer: string }, headers: HeadersInit) {
  return request<SolveRoomResponse>(`/api/rooms/${id}/tasks/${taskId}/solve`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
}

export function solveRoom(id: ApiId, data: { flag: string }, headers: HeadersInit) {
  return request<SolveRoomResponse>(`/api/rooms/${id}/solve`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
}

export function completeTaskRoom(id: ApiId, headers: HeadersInit) {
  return request<SolveRoomResponse>(`/api/rooms/${id}/tasks/complete`, {
    method: 'POST',
    headers,
  });
}

