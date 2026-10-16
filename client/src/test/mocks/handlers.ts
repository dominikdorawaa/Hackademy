import { http, HttpResponse } from 'msw';
import API_URL from '../../apiConfig';
import type { ApiError, AuthResponse, DashboardUser, LoginRequest, Role } from '../../types/api';
import { createToken, createUser, credentials } from '../fixtures/auth';
import { defaultNotificationPreferences } from '../../services/userApi';

export const loginUrl = `${API_URL}/api/auth/login`;
export const currentUserUrl = `${API_URL}/api/user/me`;

export function currentUserHandler(role: Role = 'USER') {
  return http.get<never, never, DashboardUser>(currentUserUrl, () => {
    return HttpResponse.json(createUser(role));
  });
}

export const handlers = [
  http.get(`${API_URL}/api/user/me/notification-preferences`, () => HttpResponse.json(defaultNotificationPreferences)),
  http.post<never, LoginRequest>(loginUrl, async ({ request }) => {
    const { email, password } = await request.json();
    if (email !== credentials.email || password !== credentials.password) {
      return HttpResponse.json<ApiError>({ message: 'Invalid credentials!' }, { status: 401 });
    }
    return HttpResponse.json<AuthResponse>({ token: createToken() });
  }),
  currentUserHandler(),
  http.get(`${API_URL}/api/ranking/summary`, () => HttpResponse.json({ ranking: [], user: null, myRank: null })),
  http.get(`${API_URL}/api/friends`, () => HttpResponse.json([])),
];
