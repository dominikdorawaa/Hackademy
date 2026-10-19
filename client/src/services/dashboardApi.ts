import { request } from './http';
import type { SessionScope } from './http';
import type { DashboardSummaryDto } from '../types/api';

export function getSummary(auth: SessionScope) {
  return request<DashboardSummaryDto>(`/api/dashboard/summary`, {
    method: 'GET',
    auth,
  });
}

