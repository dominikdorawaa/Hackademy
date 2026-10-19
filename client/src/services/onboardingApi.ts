import { request } from './http';
import type { SessionScope } from './http';
import type { AvatarConfig, OnboardingState, TourStatus } from '../types/api';


export function getOnboarding(auth: SessionScope, signal?: AbortSignal) {
  return request<OnboardingState>('/api/user/me/onboarding', { method: 'GET', auth, signal });
}

export function confirmAvatar(avatar: AvatarConfig, auth: SessionScope) {
  return request<OnboardingState>('/api/user/me/onboarding/avatar', { method: 'POST', auth, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(avatar) });
}

export function finishTour(status: Exclude<TourStatus, 'PENDING'>, auth: SessionScope) {
  return request<OnboardingState>('/api/user/me/onboarding/tour', { method: 'POST', auth, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
}
