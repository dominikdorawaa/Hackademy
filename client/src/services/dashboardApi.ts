import { request } from './http';
import type { DashboardSummaryDto } from '../types/api';

export function getSummary(headers: HeadersInit) {
  return request<DashboardSummaryDto>(`/api/dashboard/summary`, {
    method: 'GET',
    headers,
  });
}

