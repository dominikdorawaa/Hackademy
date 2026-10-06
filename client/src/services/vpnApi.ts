import { request } from './http';
import type { VpnStatus } from '../types/api';

export function getStatus(headers: HeadersInit) {
  return request<VpnStatus>(`/api/vpn/status`, {
    method: 'GET',
    headers,
  });
}

export function downloadConfig(headers: HeadersInit) {
  return request<never>(`/api/vpn/download`, {
    method: 'GET',
    headers,
  });
}

