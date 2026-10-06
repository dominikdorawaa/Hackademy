import { request } from './http';
import type { RankingSummaryDto } from '../types/api';

export function getSummary(headers: HeadersInit) {
  return request<RankingSummaryDto>(`/api/ranking/summary`, {
    method: 'GET',
    headers,
  });
}

