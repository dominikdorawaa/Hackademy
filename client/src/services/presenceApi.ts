import { request } from './http';
import type { SessionScope } from './http';

const tab = typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID()
  : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export function openRoomActivity(roomId: number, auth: SessionScope) {
  return request<void>(`/api/presence/room/${roomId}?tab=${tab}`, { method: 'PUT', auth, rateLimitNotice: false });
}

export function closeRoomActivity(roomId: number, auth: SessionScope) {
  return request<void>(`/api/presence/room/${roomId}?tab=${tab}`, { method: 'DELETE', auth, keepalive: true, rateLimitNotice: false });
}

export function getActivitySharing(auth: SessionScope, signal?: AbortSignal) {
  return request<{ enabled: boolean }>('/api/presence/sharing', { method: 'GET', auth, signal });
}

export function saveActivitySharing(enabled: boolean, auth: SessionScope) {
  return request<{ enabled: boolean }>('/api/presence/sharing', { method: 'PUT', auth, body: JSON.stringify({ enabled }) });
}
