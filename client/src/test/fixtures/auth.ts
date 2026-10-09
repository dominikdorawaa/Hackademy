import type { AuthUser } from '../../context/AuthContext';
import type { DashboardUser, LoginRequest, Role } from '../../types/api';

export const credentials: LoginRequest = {
  email: 'tester@example.com',
  password: 'test-password',
};

export function createToken(role: Role = 'USER', exp = Math.floor(Date.now() / 1000) + 3600) {
  const payload: AuthUser = { sub: 'tester', roles: [`ROLE_${role}`], exp };
  return `${btoa('{}')}.${btoa(JSON.stringify(payload))}.signature`;
}

export function createUser(role: Role = 'USER'): DashboardUser {
  return {
    id: 1,
    username: 'tester',
    email: credentials.email,
    role,
    points: 0,
    streak: 0,
    bio: '',
    createdAt: '2026-01-01T00:00:00Z',
    hasVpnAccess: false,
  };
}
