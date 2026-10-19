import { http, HttpResponse } from 'msw';
import API_URL from '../../apiConfig';
import type { DashboardUser, Role } from '../../types/api';
import { createUser } from '../fixtures/auth';
import { defaultNotificationPreferences } from '../../services/userApi';

export const loginUrl = `${API_URL}/api/auth/login`;
export const currentUserUrl = `${API_URL}/api/user/me`;
export const onboardingUrl = `${API_URL}/api/user/me/onboarding`;

export function currentUserHandler(role: Role = 'USER') {
  return http.get<never, never, DashboardUser>(currentUserUrl, () => {
    return HttpResponse.json(createUser(role));
  });
}

export const handlers = [
  http.get(`${API_URL}/api/user/me/notification-preferences`, () => HttpResponse.json(defaultNotificationPreferences)),
  currentUserHandler(),
  http.get(onboardingUrl, () => HttpResponse.json({ avatarConfirmed: true, tourStatus: 'COMPLETED' })),
  http.get(`${API_URL}/api/ranking/summary`, () => HttpResponse.json({ ranking: [], user: null, myRank: null })),
  http.get(`${API_URL}/api/friends`, () => HttpResponse.json([])),
];
