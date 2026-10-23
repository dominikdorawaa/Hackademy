export const ROOM_PROGRESS_CHANGED = 'hackademy:room-progress';
import { request } from './http';
import type { SessionScope } from './http';
import type { ApiId, MessageResponse, RoomSummaryDto, RoomDetailDto, SolveRoomResponse } from '../types/api';

export function getRooms(auth: SessionScope) {
  return request<RoomSummaryDto[]>(`/api/rooms`, {
    method: 'GET',
    auth,
  });
}

export function getRoom(id: ApiId, auth: SessionScope) {
  return request<RoomDetailDto>(`/api/rooms/${id}`, {
    method: 'GET',
    auth,
  });
}

export function downloadFile(id: ApiId, auth: SessionScope) {
  return request<never>(`/api/rooms/${id}/file`, {
    method: 'GET',
    auth,
  });
}

export function unlockHint(id: ApiId, hintId: ApiId, auth: SessionScope) {
  return request<MessageResponse>(`/api/rooms/${id}/hints/${hintId}/unlock`, {
    method: 'POST',
    auth,
  });
}

export function solveTask(id: ApiId, taskId: ApiId, data: { answer: string }, auth: SessionScope) {
  return request<SolveRoomResponse>(`/api/rooms/${id}/tasks/${taskId}/solve`, {
    method: 'POST',
    auth,
    body: JSON.stringify(data),
  });
}

export function solveRoom(id: ApiId, data: { flag: string }, auth: SessionScope) {
  return request<SolveRoomResponse>(`/api/rooms/${id}/solve`, {
    method: 'POST',
    auth,
    body: JSON.stringify(data),
  });
}

export function completeTaskRoom(id: ApiId, auth: SessionScope) {
  return request<SolveRoomResponse>(`/api/rooms/${id}/tasks/complete`, {
    method: 'POST',
    auth,
  });
}

