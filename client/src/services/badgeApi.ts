import { request } from './http';
import type { BadgeDto } from '../types/api';

export function getAll(headers: HeadersInit, signal?: AbortSignal) {
  return request<BadgeDto[]>(`/api/badges/all`, {
    method: 'GET',
    headers,
    signal,
  });
}
