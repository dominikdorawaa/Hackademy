import { setClerkSession } from '../test/clerk';
import { act, screen, waitFor, within } from '@testing-library/react';
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

const environment = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  return {
    state: null as RealtimeState | null,
    preferences: {} as Record<string, boolean>,
    synchronize: null as unknown as () => Promise<void>,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); },
    publish: (next: RealtimeState) => { environment.state = next; listeners.forEach(listener => listener()); },
  };
});
vi.mock('../context/RealtimeContext', async () => {
  const { useSyncExternalStore } = await import('react');
  return { useRealtime: () => ({ state: useSyncExternalStore(environment.subscribe, () => environment.state), synchronize: environment.synchronize }) };
});
vi.mock('../context/NotificationPreferencesContext', () => ({ useNotificationPreferences: () => ({ preferences: environment.preferences }) }));

const rejected = (id: string, targetUsername: string): Challenge => ({ id, challengerId: 1, challengerUsername: 'tester', targetId: 2,
  targetUsername, createdAt: '2026-10-24T12:00:00', status: 'REJECTED', expiresAt: 1_060_000 });
const snapshot = (revision: number, rejectedChallenges: Challenge[] = []): RealtimeState => ({ streamId: 'stream', revision,
  friendRequests: [], friends: [], challenges: [], outgoingChallenges: [], expiredChallenges: [], rejectedChallenges,
  serverTime: 0, gameSession: null, queued: false });

beforeEach(() => {
  setClerkSession(createToken());
  server.use(
    http.get(`${API_URL}/api/friends/requests`, () => HttpResponse.json<FriendRequestDto[]>([])),
    http.get(`${API_URL}/api/arena/challenges`, () => HttpResponse.json<Challenge[]>([])),
  );
  environment.preferences = { ...defaultNotificationPreferences };
  environment.synchronize = vi.fn(async () => {});
  environment.state = snapshot(1);
});

async function renderNavbar() {
  renderWithAuth(<Route path="*" element={<Navbar />} />, '/dashboard');
  await screen.findByRole('button', { name: 'Menu konta' });
}

describe('rejected challenges in the notification bell', () => {
  it('shows the challenger who rejected their challenge and counts it as new until the bell closes', async () => {
    await renderNavbar();
    act(() => environment.publish(snapshot(2, [rejected('no', 'ola')])));
    const user = userEvent.setup();
    const bell = screen.getByRole('button', { name: 'Powiadomienia' });
    await user.click(bell);
    expect(screen.getByText('1 nowe')).toBeInTheDocument();
    const item = screen.getByText('ola').closest('li')!;
    expect(item).toHaveTextContent('ola odrzuca Twoje wyzwanie na pojedynek.');
    expect(item).toHaveTextContent('Tryb Rankingowy');
    expect(item).toHaveAttribute('data-unread', 'true');
    expect(within(item).queryByRole('button', { name: /Akceptuj/ })).not.toBeInTheDocument();
    await user.click(bell);
    act(() => environment.publish(snapshot(3, [rejected('no', 'ola')])));
    await user.click(bell);
    expect(screen.queryByText('1 nowe')).not.toBeInTheDocument();
    expect(screen.getByText('ola').closest('li')).toHaveAttribute('data-unread', 'false');
  });

  it('closes the entry on the server so the arena note goes away too', async () => {
    const dismissed: string[] = [];
    server.use(http.post(`${API_URL}/api/arena/challenge/:id/dismiss`, ({ params }) => {
      dismissed.push(String(params.id));
      return HttpResponse.json({ message: 'ok' });
    }));
    environment.state = snapshot(1, [rejected('no', 'ola')]);
    await renderNavbar();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Powiadomienia' }));
    await user.click(screen.getByRole('button', { name: 'Zamknij powiadomienie: ola odrzuca Twoje wyzwanie' }));
    await waitFor(() => expect(dismissed).toEqual(['no']));
    expect(environment.synchronize).toHaveBeenCalled();
    act(() => environment.publish(snapshot(2)));
    expect(screen.getByText('Brak nowych powiadomień')).toBeInTheDocument();
  });

  it('keeps the entry when closing it fails', async () => {
    server.use(http.post(`${API_URL}/api/arena/challenge/:id/dismiss`, () => HttpResponse.json({ message: 'nope' }, { status: 500 })));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    environment.state = snapshot(1, [rejected('no', 'ola')]);
    await renderNavbar();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Powiadomienia' }));
    const close = screen.getByRole('button', { name: 'Zamknij powiadomienie: ola odrzuca Twoje wyzwanie' });
    await user.click(close);
    await waitFor(() => expect(close).toBeEnabled());
    expect(environment.synchronize).not.toHaveBeenCalled();
    expect(screen.getByText('ola')).toBeInTheDocument();
  });

  it('respects the arena challenge notification preference', async () => {
    environment.preferences = { ...defaultNotificationPreferences, challenges: false };
    environment.state = snapshot(1, [rejected('no', 'ola')]);
    await renderNavbar();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Powiadomienia' }));
    expect(screen.getByText('Brak nowych powiadomień')).toBeInTheDocument();
    expect(screen.queryByText('ola')).not.toBeInTheDocument();
  });
});
