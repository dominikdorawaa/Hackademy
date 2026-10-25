import { setClerkSession } from '../test/clerk';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NavbarFriends from './NavbarFriends';
import API_URL from '../apiConfig';
import { createToken } from '../test/fixtures/auth';
import { server } from '../test/mocks/server';
import { renderWithAuth } from '../test/renderWithAuth';
import { createGameSession } from '../test/fixtures/arena';
import type { Challenge, UserSearchDto } from '../types/api';
import type { RealtimeState } from '../types/realtime';

const environment = vi.hoisted(() => ({ state: null as RealtimeState | null, synchronize: vi.fn(async () => {}) }));
vi.mock('../context/RealtimeContext', () => ({ useRealtime: () => ({ state: environment.state, synchronize: environment.synchronize }) }));

const friend = (id: number, username: string, online: boolean) => ({ id, username, points: 0, streak: 0, online });
const challengeTo = (targetUsername: string): Challenge => ({ id: `c-${targetUsername}`, challengerId: 1, challengerUsername: 'me',
  targetId: 9, targetUsername, createdAt: '2026-10-20T10:00:00', status: 'PENDING', expiresAt: 1_060_000 });
const player = (id: number, username: string, friendshipStatus: UserSearchDto['friendshipStatus']): UserSearchDto =>
  ({ id, username, points: 0, friendshipStatus, winsAgainst: 0, lossesAgainst: 0 });

beforeEach(() => {
  setClerkSession(createToken());
  environment.synchronize.mockClear();
  environment.state = { streamId: 'stream', revision: 1, challenges: [], gameSession: null, queued: false,
    friendRequests: [{ id: 5, requesterUsername: 'nowy', createdAt: '2026-10-20T09:00:00' }],
    outgoingChallenges: [], expiredChallenges: [], rejectedChallenges: [], serverTime: 0,
    friends: [friend(2, 'ola', true), friend(3, 'kuba', true), friend(4, 'zenek', false)] };
});

async function openPanel() {
  renderWithAuth(<Route path="*" element={<NavbarFriends />} />, '/dashboard');
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Znajomi online: 2' }));
  return { user, panel: screen.getByRole('dialog', { name: 'Znajomi' }) };
}

describe('friends panel in the top bar', () => {
  it('lists requests and online friends, with offline friends folded away', async () => {
    const { user, panel } = await openPanel();
    expect(within(panel).getByRole('heading', { name: 'Zaproszenia (1)' })).toBeInTheDocument();
    const online = within(panel).getByRole('region', { name: 'Znajomi online' });
    expect(within(online).getAllByRole('link').map(link => link.textContent)).toEqual(['kuba', 'ola']);
    expect(within(panel).queryByText('zenek')).not.toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Offline (1)' }));
    expect(within(panel).getByRole('link', { name: 'zenek' })).toHaveAttribute('href', '/profile/zenek');
    expect(within(panel).getByRole('link', { name: 'Zarządzaj znajomymi' })).toHaveAttribute('href', '/friends');
  });

  it('shows what friends are doing and when offline ones were last seen', async () => {
    environment.state!.friends = [{ ...friend(2, 'ola', true), activity: 'ROOM', activityRoom: 'Ukryty skarb' },
      { ...friend(3, 'kuba', true), activity: 'DUEL' }, { ...friend(4, 'zenek', false), lastSeenAt: Date.now() - 2 * 3_600_000 }];
    const { user, panel } = await openPanel();
    expect(within(panel).getByRole('link', { name: 'ola rozwiązuje pokój Ukryty skarb' })).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'kuba w pojedynku' })).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Offline (1)' }));
    expect(within(panel).getByRole('link', { name: 'zenek ostatnio online 2h temu' })).toBeInTheDocument();
  });

  it('challenges an online friend and shows a challenge already sent', async () => {
    const created = vi.fn();
    server.use(http.post(`${API_URL}/api/arena/challenge/create`, async ({ request }) => {
      created(await request.json());
      return HttpResponse.json({ message: 'ok' });
    }));
    const { user, panel } = await openPanel();
    await user.click(within(panel).getByRole('button', { name: 'Wyzwij ola na pojedynek' }));
    await waitFor(() => expect(created).toHaveBeenCalledWith({ targetUsername: 'ola' }));
    expect(environment.synchronize).toHaveBeenCalled();
  });

  it('lets the player challenge others and queue while a challenge waits', async () => {
    environment.state = { ...environment.state!, queued: true, outgoingChallenges: [challengeTo('kuba')] };
    const { panel } = await openPanel();
    expect(within(panel).getByText('Wysłano')).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Wyzwij ola na pojedynek' })).toBeInTheDocument();
  });

  it('blocks challenges during a game', async () => {
    environment.state = { ...environment.state!, gameSession: createGameSession({ id: 'g', player1Username: 'me', player2Username: 'x' }) };
    const { panel } = await openPanel();
    expect(within(panel).queryByRole('button', { name: /Wyzwij/ })).not.toBeInTheDocument();
    expect(within(panel).getByText('Trwa Twój pojedynek. Wyzwania wrócą po nim.')).toBeInTheDocument();
  });

  it('takes back a challenge to a friend who went offline', async () => {
    environment.state = { ...environment.state!, outgoingChallenges: [challengeTo('zenek')] };
    const { user, panel } = await openPanel();
    await user.click(within(panel).getByRole('button', { name: 'Offline (1)' }));
    expect(within(panel).getByRole('button', { name: 'Cofnij wyzwanie dla zenek' })).toBeInTheDocument();
  });

  it('takes back a sent challenge', async () => {
    const cancelled = vi.fn();
    server.use(http.post(`${API_URL}/api/arena/challenge/c-kuba/cancel`, () => { cancelled(); return HttpResponse.json({ message: 'ok' }); }));
    environment.state = { ...environment.state!, outgoingChallenges: [challengeTo('kuba')] };
    const { user, panel } = await openPanel();
    await user.click(within(panel).getByRole('button', { name: 'Cofnij wyzwanie dla kuba' }));
    await waitFor(() => expect(cancelled).toHaveBeenCalled());
    expect(environment.synchronize).toHaveBeenCalled();
  });

  it('lets a searched player who just sent a request be accepted instead of invited', async () => {
    server.use(http.get(`${API_URL}/api/user/search`, () => HttpResponse.json([player(6, 'nowy', 'NONE')])));
    const { user, panel } = await openPanel();
    await user.type(within(panel).getByRole('searchbox'), 'no');
    const others = within(panel).getByRole('region', { name: 'Inni gracze' });
    expect(await within(others).findByRole('button', { name: 'Przyjmij zaproszenie od nowy' })).toBeInTheDocument();
    expect(within(others).queryByRole('button', { name: /Dodaj/ })).not.toBeInTheDocument();
  });

  it('shows the server message when a challenge fails', async () => {
    server.use(http.post(`${API_URL}/api/arena/challenge/create`,
      () => HttpResponse.json({ message: 'ola jest już w pojedynku' }, { status: 400 })));
    const { user, panel } = await openPanel();
    await user.click(within(panel).getByRole('button', { name: 'Wyzwij ola na pojedynek' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent('ola jest już w pojedynku');
  });

  it('accepts a friend request', async () => {
    const accepted = vi.fn();
    server.use(http.post(`${API_URL}/api/friends/accept/5`, () => { accepted(); return HttpResponse.json({ message: 'ok' }); }));
    const { user, panel } = await openPanel();
    await user.click(within(panel).getByRole('button', { name: 'Przyjmij zaproszenie od nowy' }));
    await waitFor(() => expect(accepted).toHaveBeenCalled());
  });

  it('filters friends and finds other players to invite', async () => {
    const invited = vi.fn();
    server.use(
      http.get(`${API_URL}/api/user/search`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('query')).toBe('ol');
        return HttpResponse.json([player(2, 'ola', 'FRIENDS'), player(7, 'olek', 'NONE'), player(8, 'oliwia', 'REQUEST_SENT')]);
      }),
      http.post(`${API_URL}/api/friends/request/olek`, () => { invited(); return HttpResponse.json({ message: 'ok' }); }),
    );
    const { user, panel } = await openPanel();
    await user.type(within(panel).getByRole('searchbox', { name: 'Szukaj znajomych lub graczy' }), 'ol');
    const online = within(panel).getByRole('region', { name: 'Znajomi online' });
    expect(within(online).getAllByRole('link').map(link => link.textContent)).toEqual(['ola']);
    expect(within(panel).queryByRole('heading', { name: /Zaproszenia/ })).not.toBeInTheDocument();
    const others = within(panel).getByRole('region', { name: 'Inni gracze' });
    await within(others).findByRole('link', { name: 'olek' });
    expect(within(others).queryByRole('link', { name: 'ola' })).not.toBeInTheDocument();
    expect(within(others).getByText('Wysłano')).toBeInTheDocument();
    await user.click(within(others).getByRole('button', { name: 'Dodaj olek do znajomych' }));
    await waitFor(() => expect(invited).toHaveBeenCalled());
    expect(await within(others).findAllByText('Wysłano')).toHaveLength(2);
  });

  it('closes on Escape, returns focus to the toggle and forgets the search', async () => {
    const { user, panel } = await openPanel();
    await user.type(within(panel).getByRole('searchbox'), 'z');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Znajomi online: 2' });
    expect(toggle).toHaveFocus();
    await user.click(toggle);
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });
});
