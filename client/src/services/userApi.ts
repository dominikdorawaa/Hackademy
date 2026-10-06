import { request } from './http';
import type { ActivityDto, RecentSolvedRoomDto, DashboardUser, UserProfileDto, UserSearchDto } from '../types/api';

export function getCurrentUser(headers: HeadersInit, signal?: AbortSignal) {
  return request<DashboardUser>(`/api/user/me`, {
    method: 'GET',
    headers,
    ...(signal ? { signal } : {}),
  });
}

export function getMyActivity(headers: HeadersInit) {
  return request<ActivityDto[]>(`/api/user/me/activity`, {
    method: 'GET',
    headers,
  });
}

export function getRecentSolved(limit: number, headers: HeadersInit) {
  return request<RecentSolvedRoomDto[]>(`/api/user/me/recent-solved?limit=${limit}`, {
    method: 'GET',
    headers,
  });
}

export function addActiveTime(data: { deltaSeconds: number }, headers: HeadersInit) {
  return request<{ secondsThisWeek: number }>(`/api/user/me/active-time`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
}

export function searchUsers(query: string, headers: HeadersInit) {
  return request<UserSearchDto[]>(`/api/user/search?query=${query}`, {
    method: 'GET',
    headers,
  });
}

export function getActivity(username: string, headers: HeadersInit) {
  return request<ActivityDto[]>(`/api/user/${username}/activity`, {
    method: 'GET',
    headers,
  });
}

export function getProfile(username: string, headers: HeadersInit) {
  return request<UserProfileDto>(`/api/user/${username}`, {
    method: 'GET',
    headers,
  });
}

