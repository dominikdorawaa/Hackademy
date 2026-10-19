import { request } from './http';
import type { SessionScope } from './http';
import type {
  FriendshipStatus,
  ApiId,
  MessageResponse,
  FriendDto,
  FriendRequestDto,
  UserSearchDto,
} from '../types/api';

export function getFriends(auth: SessionScope) {
  return request<FriendDto[]>(`/api/friends`, {
    method: 'GET',
    auth,
  });
}

export function getRequests(auth: SessionScope) {
  return request<FriendRequestDto[]>(`/api/friends/requests`, {
    method: 'GET',
    auth,
  });
}

export function sendRequest(username: string, auth: SessionScope, signal?: AbortSignal) {
  return request<MessageResponse>(`/api/friends/request/${encodeURIComponent(username)}`, {
    method: 'POST',
    auth,
    signal,
  });
}

export function acceptRequest(id: ApiId, auth: SessionScope) {
  return request<MessageResponse>(`/api/friends/accept/${id}`, {
    method: 'POST',
    auth,
  });
}

export function rejectRequest(id: ApiId, auth: SessionScope) {
  return request<MessageResponse>(`/api/friends/reject/${id}`, {
    method: 'POST',
    auth,
  });
}

export function removeFriend(id: ApiId, auth: SessionScope) {
  return request<MessageResponse>(`/api/friends/${id}`, {
    method: 'DELETE',
    auth,
  });
}

export function getStatus(username: string, auth: SessionScope, signal?: AbortSignal) {
  return request<{ status: FriendshipStatus }>(
    `/api/friends/status/${encodeURIComponent(username)}`,
    {
      method: 'GET',
      auth,
      signal,
    },
  );
}

export function getStats(username: string, auth: SessionScope, signal?: AbortSignal) {
  return request<UserSearchDto>(`/api/friends/stats/${encodeURIComponent(username)}`, {
    method: 'GET',
    auth,
    signal,
  });
}
