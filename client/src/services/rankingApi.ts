import { request } from './http';
import type { SessionScope } from './http';
import type { RankingSummaryDto } from '../types/api';

export function getSummary(auth: SessionScope) {
  return request<RankingSummaryDto>(`/api/ranking/summary`, {
    method: 'GET',
    auth,
  });
}

