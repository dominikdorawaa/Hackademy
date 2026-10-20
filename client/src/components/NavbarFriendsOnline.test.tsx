import { setClerkSession } from '../test/clerk';
import { act, screen, within } from '@testing-library/react';
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
import { FriendOnlineFeedProvider } from '../context/FriendOnlineFeedContext';
import type { Challenge, FriendRequestDto } from '../types/api';
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
  return { useRealtime: () => ({ state: useSyncExternalStore(environment.subscribe, () => environment.state), synchronize: vi.fn() }) };
});
vi.mock('../context/NotificationPreferencesContext', () => ({ useNotificationPreferences: () => ({ preferences: environment.preferences }) }));

const friend = (id: number, username: string, online: boolean) => ({ id, username, points: 0, streak: 0, online });
const snapshot = (friends: ReturnType<typeof friend>[], revision = 1): RealtimeState => ({ streamId: 'stream', revision,
  friendRequests: [], challenges: [], outgoingChallenges: [], gameSession: null, queued: false, friends });

beforeEach(() => {
  setClerkSession(createToken());
  server.use(
    http.get(`${API_URL}/api/friends/requests`, () => HttpResponse.json<FriendRequestDto[]>([])),
    http.get(`${API_URL}/api/arena/challenges`, () => HttpResponse.json<Challenge[]>([])),
  );
  environment.preferences = { ...defaultNotificationPreferences };
  environment.state = snapshot([friend(2, 'ola', false), friend(3, 'kuba', true)]);
});

async function renderNavbar() {
  renderWithAuth(<Route path="*" element={<FriendOnlineFeedProvider><Navbar /></FriendOnlineFeedProvider>} />, '/profile');
  await screen.findByRole('button', { name: 'Menu konta' });
}

const comeOnline = () => act(() => environment.publish(snapshot([friend(2, 'ola', true), friend(3, 'kuba', true)], 2)));

describe('friends online in the notification bell', () => {
  it('does not list friends who were already online when the page loaded', async () => {
    await renderNavbar();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Powiadomienia' }));
    expect(screen.getByText('Brak nowych powiadomień')).toBeInTheDocument();
  });

  it('adds one closable entry without a profile link when a friend comes online', async () => {
    await renderNavbar();
    comeOnline();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Powiadomienia' }));
    expect(screen.getByText('1 nowe')).toBeInTheDocument();
    const item = screen.getByText('ola').closest('li')!;
    expect(item).toHaveTextContent('ola jest online');
    expect(within(item).queryByRole('link')).not.toBeInTheDocument();
    await user.click(within(item).getByRole('button', { name: 'Zamknij powiadomienie: ola jest online' }));
    expect(screen.queryByText('ola')).not.toBeInTheDocument();
  });

  it('keeps a seen entry but stops counting it as new after the bell closes', async () => {
    await renderNavbar();
    comeOnline();
    const user = userEvent.setup();
    const bell = screen.getByRole('button', { name: 'Powiadomienia' });
    await user.click(bell);
    await user.click(bell);
    await user.click(bell);
    expect(screen.getByText('ola').closest('li')).toHaveAttribute('data-unread', 'false');
    expect(screen.queryByText(/nowe/)).not.toBeInTheDocument();
  });

  it('adds nothing when the bell preference is off', async () => {
    environment.preferences = { ...environment.preferences, friendOnlineBell: false };
    await renderNavbar();
    comeOnline();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Powiadomienia' }));
    expect(screen.getByText('Brak nowych powiadomień')).toBeInTheDocument();
  });
});

describe('friends online in the top bar', () => {
  it('shows how many friends are online and lists them', async () => {
    await renderNavbar();
    const button = screen.getByRole('button', { name: 'Znajomi online: 1' });
    await userEvent.setup().click(button);
    const panel = screen.getByRole('group', { name: 'Znajomi online' });
    expect(within(panel).getByRole('link', { name: 'kuba' })).toHaveAttribute('href', '/profile/kuba');
    expect(within(panel).queryByText('ola')).not.toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Wszyscy znajomi' })).toHaveAttribute('href', '/friends');
  });

  it('updates the count live when a friend comes online', async () => {
    await renderNavbar();
    comeOnline();
    expect(screen.getByRole('button', { name: 'Znajomi online: 2' })).toBeInTheDocument();
  });
});
