import { request } from './http';
import type { AuthResponse, LoginRequest, RegisterRequest } from '../types/api';

export function login(data: LoginRequest, headers: HeadersInit) {
  return request<AuthResponse>(`/api/auth/login`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
}

export function register(data: RegisterRequest, headers: HeadersInit) {
  return request<AuthResponse>(`/api/auth/register`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
}

