import { request } from './http';
import type { SessionScope } from './http';
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
import type { AvatarConfig } from '../types/api';

export interface NotificationPreferences {
  friendRequests: boolean;
  challenges: boolean;
  matchFound: boolean;
  sound: boolean;
  browserNotifications: boolean;
  friendOnline: boolean;
  friendOnlineBell: boolean;
}

export const defaultNotificationPreferences: NotificationPreferences = {
  friendRequests: true, challenges: true, matchFound: true, sound: true, browserNotifications: false, friendOnline: true, friendOnlineBell: true,
};

export function getNotificationPreferences(auth: SessionScope, signal?: AbortSignal) {
  return request<NotificationPreferences>('/api/user/me/notification-preferences', { method: 'GET', auth, signal });
}

export function saveNotificationPreference(preference: keyof NotificationPreferences, enabled: boolean, auth: SessionScope, signal?: AbortSignal) {
  return request<NotificationPreferences>('/api/user/me/notification-preferences', {
    method: 'PATCH', auth, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preference, enabled }), signal,
  });
}

export function changeUsername(newUsername: string, auth: SessionScope) {
  return request<{ username: string }>('/api/user/me/username', {
    method: 'PATCH', auth, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newUsername }),
  });
}

export function updateProfile(profile: ProfilePersonalization, auth: SessionScope, signal?: AbortSignal) {
  return request<ProfilePersonalization>('/api/user/me/profile', {
    method: 'PATCH', auth, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile), signal,
  });
}

export function saveAvatar(avatar: AvatarConfig, auth: SessionScope, signal?: AbortSignal) {
  return request<AvatarConfig>('/api/user/me/avatar', {
    method: 'PUT', auth, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(avatar), signal,
  });
}

export function getCurrentUser(auth: SessionScope, signal?: AbortSignal) {
  return request<DashboardUser>(`/api/user/me`, {
    method: 'GET',
    auth,
    ...(signal ? { signal } : {}),
  });
}

export function getPortfolio(username: string | undefined, auth: SessionScope, signal?: AbortSignal) {
  return request<ProfilePortfolioDto>(`/api/user/${username ? encodeURIComponent(username) : 'me'}/portfolio`, {
    method: 'GET', auth, signal,
  });
}

export function getMyActivity(auth: SessionScope, signal?: AbortSignal) {
  return request<ActivityDto[]>(`/api/user/me/activity`, {
    method: 'GET',
    auth,
    signal,
  });
}

export function getProfileStats(
  username: string | undefined,
  auth: SessionScope,
  signal?: AbortSignal,
) {
  return request<ProfileStatsDto>(
    `/api/user/${username ? encodeURIComponent(username) : 'me'}/stats`,
    {
      method: 'GET',
      auth,
      signal,
    },
  );
}

export function getRecentSolved(
  limit: number,
  auth: SessionScope,
  signal?: AbortSignal,
) {
  return request<RecentSolvedRoomDto[]>(
    `/api/user/me/recent-solved?limit=${limit}`,
    {
      method: 'GET',
      auth,
      signal,
    },
  );
}

export function addActiveTime(
  data: { deltaSeconds: number },
  auth: SessionScope,
) {
  return request<{ secondsThisWeek: number }>(`/api/user/me/active-time`, {
    method: 'POST',
    auth,
    body: JSON.stringify(data),
  });
}

export function searchUsers(query: string, auth: SessionScope) {
  return request<UserSearchDto[]>(`/api/user/search?query=${query}`, {
    method: 'GET',
    auth,
  });
}

export function getActivity(
  username: string,
  auth: SessionScope,
  signal?: AbortSignal,
) {
  return request<ActivityDto[]>(
    `/api/user/${encodeURIComponent(username)}/activity`,
    {
      method: 'GET',
      auth,
      signal,
    },
  );
}

export function getProfile(
  username: string,
  auth: SessionScope,
  signal?: AbortSignal,
) {
  return request<UserProfileDto>(`/api/user/${encodeURIComponent(username)}`, {
    method: 'GET',
    auth,
    signal,
  });
}

export function getUserRecentSolved(
  username: string,
  limit: number,
  auth: SessionScope,
  signal?: AbortSignal,
) {
  return request<RecentSolvedRoomDto[]>(
    `/api/user/${encodeURIComponent(username)}/recent-solved?limit=${limit}`,
    {
      method: 'GET',
      auth,
      signal,
    },
  );
}

export function updateBio(
  bio: string,
  auth: SessionScope,
  signal?: AbortSignal,
) {
  return request<void>('/api/user/me/bio', {
    method: 'PATCH',
    auth, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bio }),
    signal,
  });
}
