import { request } from './http';
import type { SessionScope } from './http';
import type { VpnStatus } from '../types/api';

export function getStatus(auth: SessionScope) {
  return request<VpnStatus>(`/api/vpn/status`, {
    method: 'GET',
    auth,
  });
}

export function downloadConfig(auth: SessionScope) {
  return request<never>(`/api/vpn/download`, {
    method: 'GET',
    auth,
  });
}

