import { getCurrentUser } from './userApi';
import { request } from './http';
import type { SessionScope } from './http';
import type { AvatarConfig, OnboardingState, TourStatus } from '../types/api';


export function getOnboarding(auth: SessionScope, signal?: AbortSignal) {
  return getCurrentUser(auth, signal).then(async response => {
    if (response.ok) {
      const user = await response.json();
      if (user.onboarding) return new Response(JSON.stringify(user.onboarding), { status: 200 }) as import('./http').ApiResponse<OnboardingState>;
    }
    return request<OnboardingState>('/api/user/me/onboarding', { method: 'GET', auth, signal });
  });
}

export function confirmAvatar(avatar: AvatarConfig, auth: SessionScope) {
  return request<OnboardingState>('/api/user/me/onboarding/avatar', { method: 'POST', auth, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(avatar) });
}

export function finishTour(status: Exclude<TourStatus, 'PENDING'>, auth: SessionScope) {
  return request<OnboardingState>('/api/user/me/onboarding/tour', { method: 'POST', auth, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
}
