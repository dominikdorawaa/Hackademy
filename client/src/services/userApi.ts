import { request } from './http';
import type {
  ActivityDto,
  RecentSolvedRoomDto,
  DashboardUser,
  UserProfileDto,
  UserSearchDto,
  ProfileStatsDto,
  ProfilePortfolioDto,
} from '../types/api';
import type { ProfilePersonalization } from '../lib/profile';
import type { AuthResponse, AvatarConfig } from '../types/api';

export interface NotificationPreferences {
  friendRequests: boolean;
  challenges: boolean;
  matchFound: boolean;
  sound: boolean;
  browserNotifications: boolean;
}

export const defaultNotificationPreferences: NotificationPreferences = {
  friendRequests: true, challenges: true, matchFound: true, sound: false, browserNotifications: false,
};

export function getNotificationPreferences(headers: HeadersInit, signal?: AbortSignal) {
  return request<NotificationPreferences>('/api/user/me/notification-preferences', { method: 'GET', headers, signal });
}

export function saveNotificationPreference(preference: keyof NotificationPreferences, enabled: boolean, headers: HeadersInit, signal?: AbortSignal) {
  return request<NotificationPreferences>('/api/user/me/notification-preferences', {
    method: 'PATCH', headers: { ...Object.fromEntries(new Headers(headers)), 'Content-Type': 'application/json' },
    body: JSON.stringify({ preference, enabled }), signal,
  });
}

export function changePassword(currentPassword: string, newPassword: string, headers: HeadersInit) {
  return request<void>('/api/user/me/password', {
    method: 'PATCH', headers: { ...Object.fromEntries(new Headers(headers)), 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function changeUsername(newUsername: string, headers: HeadersInit) {
  return request<AuthResponse>('/api/user/me/username', {
    method: 'PATCH', headers: { ...Object.fromEntries(new Headers(headers)), 'Content-Type': 'application/json' },
    body: JSON.stringify({ newUsername }),
  });
}

export function updateProfile(profile: ProfilePersonalization, headers: HeadersInit, signal?: AbortSignal) {
  return request<ProfilePersonalization>('/api/user/me/profile', {
    method: 'PATCH', headers: { ...Object.fromEntries(new Headers(headers)), 'Content-Type': 'application/json' },
    body: JSON.stringify(profile), signal,
  });
}

export function saveAvatar(avatar: AvatarConfig, headers: HeadersInit, signal?: AbortSignal) {
  return request<AvatarConfig>('/api/user/me/avatar', {
    method: 'PUT', headers: { ...Object.fromEntries(new Headers(headers)), 'Content-Type': 'application/json' },
    body: JSON.stringify(avatar), signal,
  });
}

export function getCurrentUser(headers: HeadersInit, signal?: AbortSignal) {
  return request<DashboardUser>(`/api/user/me`, {
    method: 'GET',
    headers,
    ...(signal ? { signal } : {}),
  });
}

export function getPortfolio(username: string | undefined, headers: HeadersInit, signal?: AbortSignal) {
  return request<ProfilePortfolioDto>(`/api/user/${username ? encodeURIComponent(username) : 'me'}/portfolio`, {
    method: 'GET', headers, signal,
  });
}

export function getMyActivity(headers: HeadersInit, signal?: AbortSignal) {
  return request<ActivityDto[]>(`/api/user/me/activity`, {
    method: 'GET',
    headers,
    signal,
  });
}

export function getProfileStats(
  username: string | undefined,
  headers: HeadersInit,
  signal?: AbortSignal,
) {
  return request<ProfileStatsDto>(
    `/api/user/${username ? encodeURIComponent(username) : 'me'}/stats`,
    {
      method: 'GET',
      headers,
      signal,
    },
  );
}

export function getRecentSolved(
  limit: number,
  headers: HeadersInit,
  signal?: AbortSignal,
) {
  return request<RecentSolvedRoomDto[]>(
    `/api/user/me/recent-solved?limit=${limit}`,
    {
      method: 'GET',
      headers,
      signal,
    },
  );
}

export function addActiveTime(
  data: { deltaSeconds: number },
  headers: HeadersInit,
) {
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

export function getActivity(
  username: string,
  headers: HeadersInit,
  signal?: AbortSignal,
) {
  return request<ActivityDto[]>(
    `/api/user/${encodeURIComponent(username)}/activity`,
    {
      method: 'GET',
      headers,
      signal,
    },
  );
}

export function getProfile(
  username: string,
  headers: HeadersInit,
  signal?: AbortSignal,
) {
  return request<UserProfileDto>(`/api/user/${encodeURIComponent(username)}`, {
    method: 'GET',
    headers,
    signal,
  });
}

export function getUserRecentSolved(
  username: string,
  limit: number,
  headers: HeadersInit,
  signal?: AbortSignal,
) {
  return request<RecentSolvedRoomDto[]>(
    `/api/user/${encodeURIComponent(username)}/recent-solved?limit=${limit}`,
    {
      method: 'GET',
      headers,
      signal,
    },
  );
}

export function updateBio(
  bio: string,
  headers: HeadersInit,
  signal?: AbortSignal,
) {
  return request<void>('/api/user/me/bio', {
    method: 'PATCH',
    headers: {
      ...Object.fromEntries(new Headers(headers)),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ bio }),
    signal,
  });
}
