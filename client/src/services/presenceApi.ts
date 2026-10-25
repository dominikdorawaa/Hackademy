import { request } from './http';
import type { SessionScope } from './http';

export function openRoomActivity(roomId: number, auth: SessionScope) {
  return request<void>(`/api/presence/room/${roomId}`, { method: 'PUT', auth, rateLimitNotice: false });
}

export function closeRoomActivity(roomId: number, auth: SessionScope) {
  return request<void>(`/api/presence/room/${roomId}`, { method: 'DELETE', auth, keepalive: true, rateLimitNotice: false });
}

export function getActivitySharing(auth: SessionScope, signal?: AbortSignal) {
  return request<{ enabled: boolean }>('/api/presence/sharing', { method: 'GET', auth, signal });
}

export function saveActivitySharing(enabled: boolean, auth: SessionScope) {
  return request<{ enabled: boolean }>('/api/presence/sharing', { method: 'PUT', auth, body: JSON.stringify({ enabled }) });
}
