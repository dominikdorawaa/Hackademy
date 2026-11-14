import { request } from './http';
import type { SessionScope } from './http';
import type { ApiId, ShopState, TopUpOrder, WalletAdmin } from '../types/api';

const json = (body: unknown) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export function getShop(auth: SessionScope, signal?: AbortSignal) {
  return request<ShopState>('/api/shop', { method: 'GET', auth, signal });
}

export function buyItem(itemId: string, auth: SessionScope) {
  return request<ShopState>(`/api/shop/items/${encodeURIComponent(itemId)}/purchase`, { method: 'POST', auth, ...json({}) });
}

export function startTopUp(packageId: string, auth: SessionScope) {
  return request<TopUpOrder>('/api/shop/top-ups', { method: 'POST', auth, ...json({ packageId }) });
}

export function payTestTopUp(orderId: ApiId, auth: SessionScope) {
  return request<ShopState>(`/api/shop/top-ups/${orderId}/test-payment`, { method: 'POST', auth, ...json({}) });
}

export function cancelTopUp(orderId: ApiId, auth: SessionScope) {
  return request<void>(`/api/shop/top-ups/${orderId}/cancel`, { method: 'POST', auth, ...json({}) });
}

export function getWallet(userId: ApiId, auth: SessionScope) {
  return request<WalletAdmin>(`/api/admin/users/${userId}/wallet`, { method: 'GET', auth });
}

export function adjustWallet(userId: ApiId, amount: number, reason: string, auth: SessionScope) {
  return request<WalletAdmin>(`/api/admin/users/${userId}/wallet`, { method: 'POST', auth, ...json({ amount, reason }) });
}

export async function errorMessage(response: { json(): Promise<unknown> }, fallback: string) {
  const body = await response.json().catch(() => null) as { message?: unknown } | null;
  return typeof body?.message === 'string' && body.message ? body.message : fallback;
}
