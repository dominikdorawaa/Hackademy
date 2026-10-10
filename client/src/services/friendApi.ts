import { request } from './http';
import type {
  FriendshipStatus,
  ApiId,
  MessageResponse,
  FriendDto,
  FriendRequestDto,
  UserSearchDto,
} from '../types/api';

export function getFriends(headers: HeadersInit) {
  return request<FriendDto[]>(`/api/friends`, {
    method: 'GET',
    headers,
  });
}

export function getRequests(headers: HeadersInit) {
  return request<FriendRequestDto[]>(`/api/friends/requests`, {
    method: 'GET',
    headers,
  });
}

export function sendRequest(username: string, headers: HeadersInit, signal?: AbortSignal) {
  return request<MessageResponse>(`/api/friends/request/${encodeURIComponent(username)}`, {
    method: 'POST',
    headers,
    signal,
  });
}

export function acceptRequest(id: ApiId, headers: HeadersInit) {
  return request<MessageResponse>(`/api/friends/accept/${id}`, {
    method: 'POST',
    headers,
  });
}

export function rejectRequest(id: ApiId, headers: HeadersInit) {
  return request<MessageResponse>(`/api/friends/reject/${id}`, {
    method: 'POST',
    headers,
  });
}

export function removeFriend(id: ApiId, headers: HeadersInit) {
  return request<MessageResponse>(`/api/friends/${id}`, {
    method: 'DELETE',
    headers,
  });
}

export function getStatus(username: string, headers: HeadersInit, signal?: AbortSignal) {
  return request<{ status: FriendshipStatus }>(
    `/api/friends/status/${encodeURIComponent(username)}`,
    {
      method: 'GET',
      headers,
      signal,
    },
  );
}

export function getStats(username: string, headers: HeadersInit, signal?: AbortSignal) {
  return request<UserSearchDto>(`/api/friends/stats/${encodeURIComponent(username)}`, {
    method: 'GET',
    headers,
    signal,
  });
}
