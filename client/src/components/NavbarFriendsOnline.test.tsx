import { screen, within } from '@testing-library/react';
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
import type { Challenge, FriendRequestDto } from '../types/api';
import type { RealtimeState } from '../types/realtime';

const environment = vi.hoisted(() => ({ state: null as RealtimeState | null, preferences: {} as Record<string, boolean> }));
vi.mock('../context/RealtimeContext', () => ({ useRealtime: () => ({ state: environment.state, synchronize: vi.fn() }) }));
vi.mock('../context/NotificationPreferencesContext', () => ({ useNotificationPreferences: () => ({ preferences: environment.preferences }) }));

const friend = (id: number, username: string, online: boolean) => ({ id, username, points: 0, streak: 0, online });

beforeEach(() => {
  localStorage.setItem('token', createToken());
  server.use(
    http.get(`${API_URL}/api/friends/requests`, () => HttpResponse.json<FriendRequestDto[]>([])),
    http.get(`${API_URL}/api/arena/challenges`, () => HttpResponse.json<Challenge[]>([])),
  );
  environment.preferences = { ...defaultNotificationPreferences };
  environment.state = { streamId: 'stream', revision: 1, friendRequests: [], challenges: [], outgoingChallenges: [],
    gameSession: null, queued: false, friends: [friend(2, 'ola', true), friend(3, 'kuba', false)] };
});

async function openBell() {
  renderWithAuth(<Route path="*" element={<Navbar />} />, '/profile');
  await screen.findByRole('button', { name: 'Menu konta' });
  await userEvent.setup().click(screen.getByRole('button', { name: 'Powiadomienia' }));
}

describe('friends online in the notification bell', () => {
  it('lists friends who are online now without counting them as new', async () => {
    await openBell();
    const item = screen.getByText('ola').closest('li')!;
    expect(item).toHaveTextContent('ola jest online.');
    expect(within(item).getByRole('link', { name: 'Profil' })).toHaveAttribute('href', '/profile/ola');
    expect(screen.queryByText('kuba')).not.toBeInTheDocument();
    expect(screen.queryByText(/nowe/)).not.toBeInTheDocument();
  });

  it('hides online friends when the bell preference is off', async () => {
    environment.preferences = { ...environment.preferences, friendOnlineBell: false };
    await openBell();
    expect(screen.queryByText('ola')).not.toBeInTheDocument();
    expect(screen.getByText('Brak nowych powiadomień')).toBeInTheDocument();
  });
});
