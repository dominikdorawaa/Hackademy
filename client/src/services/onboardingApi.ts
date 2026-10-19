import { request } from './http';
import type { AvatarConfig, OnboardingState, TourStatus } from '../types/api';

const json = (headers: HeadersInit) => ({ ...Object.fromEntries(new Headers(headers)), 'Content-Type': 'application/json' });

export function getOnboarding(headers: HeadersInit, signal?: AbortSignal) {
  return request<OnboardingState>('/api/user/me/onboarding', { method: 'GET', headers, signal });
}

export function confirmAvatar(avatar: AvatarConfig, headers: HeadersInit) {
  return request<OnboardingState>('/api/user/me/onboarding/avatar', { method: 'POST', headers: json(headers), body: JSON.stringify(avatar) });
}

export function finishTour(status: Exclude<TourStatus, 'PENDING'>, headers: HeadersInit) {
  return request<OnboardingState>('/api/user/me/onboarding/tour', { method: 'POST', headers: json(headers), body: JSON.stringify({ status }) });
}
