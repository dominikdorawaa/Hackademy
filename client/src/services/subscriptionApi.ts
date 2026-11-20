import { request } from './http';
import type { SessionScope } from './http';
import type { ApiId, SubscriptionOrder, SubscriptionState } from '../types/api';

const json = (body: unknown) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const SUBSCRIPTION_REQUIRED = 'SUBSCRIPTION_REQUIRED';

export function getSubscription(auth: SessionScope, signal?: AbortSignal) {
  return request<SubscriptionState>('/api/subscription', { method: 'GET', auth, signal });
}

export function orderSubscription(planId: string, auth: SessionScope) {
  return request<SubscriptionOrder>('/api/subscription/orders', { method: 'POST', auth, ...json({ planId }) });
}

export function payTestSubscription(orderId: ApiId, auth: SessionScope) {
  return request<SubscriptionState>(`/api/subscription/orders/${orderId}/test-payment`, { method: 'POST', auth, ...json({}) });
}

export function cancelSubscriptionOrder(orderId: ApiId, auth: SessionScope) {
  return request<void>(`/api/subscription/orders/${orderId}/cancel`, { method: 'POST', auth, ...json({}) });
}

export function getFriendsOutOfGames(auth: SessionScope, signal?: AbortSignal) {
  return request<number[]>('/api/subscription/friends/out-of-games', { method: 'GET', auth, signal });
}
