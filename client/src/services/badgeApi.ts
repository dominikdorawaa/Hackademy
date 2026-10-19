import { request } from './http';
import type { SessionScope } from './http';
import type { BadgeDto } from '../types/api';

export function getAll(auth: SessionScope, signal?: AbortSignal) {
  return request<BadgeDto[]>(`/api/badges/all`, {
    method: 'GET',
    auth,
    signal,
  });
}
