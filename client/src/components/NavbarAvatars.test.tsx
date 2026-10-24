import { setClerkSession } from '../test/clerk';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Navbar from './Navbar';
import API_URL from '../apiConfig';
import { createToken } from '../test/fixtures/auth';
import { server } from '../test/mocks/server';
import { renderWithAuth } from '../test/renderWithAuth';
import { defaultNotificationPreferences } from '../services/userApi';
import { avatarFromUsername, toAvatarConfig } from './arena/avatar/avatarModel';
import type { AvatarConfig, Challenge, FriendRequestDto } from '../types/api';
import type { RealtimeState } from '../types/realtime';

const environment = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  return {
    state: null as RealtimeState | null,
    preferences: {} as Record<string, boolean>,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); },
    publish: (next: RealtimeState) => { environment.state = next; listeners.forEach(listener => listener()); },
  };
});
vi.mock('../context/RealtimeContext', async () => {
  const { useSyncExternalStore } = await import('react');
  return { useRealtime: () => ({ state: useSyncExternalStore(environment.subscribe, () => environment.state), synchronize: async () => {} }) };
});
vi.mock('../context/NotificationPreferencesContext', () => ({ useNotificationPreferences: () => ({ preferences: environment.preferences }) }));
vi.mock('./arena/avatar/useAvatarAtlas', () => ({
  useAvatarPortrait: (config: AvatarConfig | null | undefined) => config ? `blob:${config.outfit}-${config.hair}-${config.skin}` : null,
}));

const look = (outfit: string, hair: string): AvatarConfig => ({ outfit, hair, hat: 'brak', skin: 'jasna', hairColor: 'rude',
  topColor: 'bialy', bottomColor: 'granatowy', shoesColor: 'czerwony', hatColor: 'bialy' });
const portrait = (avatar: AvatarConfig) => `blob:${avatar.outfit}-${avatar.hair}-${avatar.skin}`;
const request = (avatar?: AvatarConfig | null): FriendRequestDto => ({ id: 7, requesterUsername: 'ola', createdAt: '2026-10-24T12:00:00', avatar });
const duel = (challengerAvatar?: AvatarConfig | null): Challenge => ({ id: 'duel', challengerId: 3, challengerUsername: 'kuba', targetId: 1,
  targetUsername: 'tester', createdAt: '2026-10-24T12:00:00', status: 'PENDING', expiresAt: 1_042_000, challengerAvatar });
const rejection = (targetAvatar?: AvatarConfig | null): Challenge => ({ id: 'no', challengerId: 1, challengerUsername: 'tester', targetId: 4,
  targetUsername: 'ewa', createdAt: '2026-10-24T12:00:00', status: 'REJECTED', expiresAt: 1_060_000, targetAvatar });
const snapshot = (revision: number, parts: Partial<RealtimeState> = {}): RealtimeState => ({ streamId: 'stream', revision,
  friendRequests: [], friends: [], challenges: [], outgoingChallenges: [], expiredChallenges: [], rejectedChallenges: [],
  serverTime: 1_000_000, gameSession: null, queued: false, ...parts });

beforeEach(() => {
  setClerkSession(createToken());
  server.use(
    http.get(`${API_URL}/api/friends/requests`, () => HttpResponse.json<FriendRequestDto[]>([])),
    http.get(`${API_URL}/api/arena/challenges`, () => HttpResponse.json<Challenge[]>([])),
  );
  environment.preferences = { ...defaultNotificationPreferences };
  environment.state = snapshot(1);
});

async function openBell() {
  renderWithAuth(<Route path="*" element={<Navbar />} />, '/dashboard');
  await screen.findByRole('button', { name: 'Menu konta' });
  await userEvent.setup().click(screen.getByRole('button', { name: 'Powiadomienia' }));
}

const entry = (name: string) => screen.getByText(name).closest('li')!.querySelector('img.notification-portrait')!;

describe('portraits in the notification bell', () => {
  it('draws the saved avatar of whoever sent a friend request, a challenge or a rejection', async () => {
    const friend = look('bluza', 'irokez');
    const challenger = look('dres', 'kucyk');
    const target = look('baza', 'krotkie');
    environment.state = snapshot(1, { friendRequests: [request(friend)], challenges: [duel(challenger)], rejectedChallenges: [rejection(target)] });
    await openBell();
    expect(entry('ola')).toHaveAttribute('src', portrait(friend));
    expect(entry('kuba')).toHaveAttribute('src', portrait(challenger));
    expect(entry('ewa')).toHaveAttribute('src', portrait(target));
    for (const name of ['ola', 'kuba', 'ewa']) expect(entry(name)).toHaveAttribute('data-avatar', 'custom');
  });

  it('swaps a portrait as soon as a realtime update carries the new avatar', async () => {
    environment.state = snapshot(1, { friendRequests: [request(look('bluza', 'irokez'))], challenges: [duel(look('dres', 'kucyk'))] });
    await openBell();
    const changed = look('baza', 'brak');
    act(() => environment.publish(snapshot(2, { friendRequests: [request(changed)], challenges: [duel(changed)] })));
    expect(entry('ola')).toHaveAttribute('src', portrait(changed));
    expect(entry('kuba')).toHaveAttribute('src', portrait(changed));
  });

  it('falls back to the look generated from the name when there is no saved avatar, also after one is removed', async () => {
    environment.state = snapshot(1, { challenges: [duel(look('dres', 'kucyk'))], rejectedChallenges: [rejection(null)] });
    await openBell();
    expect(entry('ewa')).toHaveAttribute('src', portrait(toAvatarConfig(avatarFromUsername('ewa'))));
    expect(entry('ewa')).toHaveAttribute('data-avatar', 'generated');
    act(() => environment.publish(snapshot(2, { challenges: [duel(null)], rejectedChallenges: [rejection(null)] })));
    expect(entry('kuba')).toHaveAttribute('src', portrait(toAvatarConfig(avatarFromUsername('kuba'))));
    expect(entry('kuba')).toHaveAttribute('data-avatar', 'generated');
  });
});
