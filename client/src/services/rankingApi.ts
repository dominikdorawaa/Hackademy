import { request, cachedRequest } from './http';
import type { SessionScope } from './http';
import type { RankingSummaryDto } from '../types/api';

export function getSummary(auth: SessionScope) {
  return request<RankingSummaryDto>(`/api/ranking/summary`, {
    method: 'GET',
    auth,
  });
}


export function getMyRank(auth: SessionScope) {
  return cachedRequest<import('../types/api').RankingEntry>('/api/ranking/me', auth, 30_000);
}
