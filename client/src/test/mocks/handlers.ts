import { http, HttpResponse } from 'msw';
import API_URL from '../../apiConfig';
import type { AuthResponse, DashboardUser, LoginRequest, Role } from '../../types/api';
import { createToken, createUser, credentials } from '../fixtures/auth';

export const loginUrl = `${API_URL}/api/auth/login`;
export const currentUserUrl = `${API_URL}/api/user/me`;

export function currentUserHandler(role: Role = 'USER') {
  return http.get<never, never, DashboardUser>(currentUserUrl, () => {
    return HttpResponse.json(createUser(role));
  });
}

export const handlers = [
  http.post<never, LoginRequest>(loginUrl, async ({ request }) => {
    const { email, password } = await request.json();
    if (email !== credentials.email || password !== credentials.password) {
      return HttpResponse.text('Invalid credentials', { status: 401 });
    }
    return HttpResponse.json<AuthResponse>({ token: createToken() });
  }),
  currentUserHandler(),
];
