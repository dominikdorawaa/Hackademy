import { act, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route } from 'react-router-dom';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import API_URL from '../apiConfig';
import { createToken, createUser } from '../test/fixtures/auth';
import { server } from '../test/mocks/server';
import { renderWithAuth } from '../test/renderWithAuth';
import type { RealtimeState } from '../types/realtime';
import PathsPage from './PathsPage';
import PathDetailPage from './PathDetailPage';
import RoomPage from './RoomPage';
import RankingPage from './RankingPage';
import FriendsPage from './FriendsPage';
import ProfilePage from './ProfilePage';
import ProfilePeek from '../components/ProfilePeek';

const realtime = vi.hoisted(() => ({ value: { state: null as RealtimeState | null, connected: true, error: null as string | null, synchronize: vi.fn(async () => {}) } }));
vi.mock('../context/RealtimeContext', () => ({ useRealtime: () => realtime.value }));

/** A response held back until the test releases it, so the loading state can be inspected. */
function gate() {
  let release!: () => void;
  const opened = new Promise<void>(resolve => { release = resolve; });
  return { wait: () => opened, release: () => act(async () => { release(); await opened; }) };
}

function expectSkeleton(label: string) {
  const region = screen.getByRole('status', { name: label });
  expect(region).toHaveAttribute('aria-busy', 'true');
  expect(region.querySelectorAll('[data-skeleton]').length).toBeGreaterThan(0);
  return region;
}

const mount = (path: string, route: string, element: ReactNode) => renderWithAuth(<Route path={route} element={element} />, path);

beforeEach(() => {
  localStorage.setItem('token', createToken());
  realtime.value = { ...realtime.value, state: null, error: null };
});

describe('player pages show skeletons while loading', () => {
  it('paths list', async () => {
    const pending = gate();
    server.use(http.get(`${API_URL}/api/paths`, async () => { await pending.wait(); return HttpResponse.json([]); }));
    mount('/learn', '/learn', <PathsPage />);
    expect(screen.getByRole('heading', { name: 'Ścieżki' })).toBeInTheDocument();
    expect(expectSkeleton('Ładowanie ścieżek').querySelectorAll('.path-card')).toHaveLength(3);
    await pending.release();
    expect(await screen.findByText('Brak ścieżek.')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Ładowanie ścieżek' })).not.toBeInTheDocument();
  });

  it('path details, ending with the error', async () => {
    const pending = gate();
    server.use(http.get(`${API_URL}/api/paths/5`, async () => { await pending.wait(); return new HttpResponse(null, { status: 500 }); }));
    mount('/learn/paths/5', '/learn/paths/:id', <PathDetailPage />);
    expectSkeleton('Ładowanie ścieżki');
    await pending.release();
    expect(await screen.findByText(/^Błąd:/)).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Ładowanie ścieżki' })).not.toBeInTheDocument();
  });

  it('room, ending with the error', async () => {
    const pending = gate();
    server.use(http.get(`${API_URL}/api/rooms/7`, async () => { await pending.wait(); return HttpResponse.json({ message: 'Pokój zablokowany.' }, { status: 403 }); }));
    mount('/rooms/7', '/rooms/:id', <RoomPage />);
    expectSkeleton('Ładowanie pokoju');
    await pending.release();
    expect(await screen.findByText('Błąd: Pokój zablokowany.')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Ładowanie pokoju' })).not.toBeInTheDocument();
  });

  it('ranking', async () => {
    const pending = gate();
    server.use(http.get(`${API_URL}/api/ranking/summary`, async () => { await pending.wait(); return HttpResponse.json({ ranking: [], user: null, myRank: null }); }));
    mount('/ranking', '/ranking', <RankingPage />);
    expect(expectSkeleton('Ładowanie rankingów').querySelectorAll('[data-skeleton]')).toHaveLength(22);
    await pending.release();
    expect(await screen.findByText('Ranking Punktowy')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Ładowanie rankingów' })).not.toBeInTheDocument();
  });

  it('friends, until the realtime state arrives', () => {
    const view = mount('/friends', '/friends', <FriendsPage />);
    expectSkeleton('Wczytuję znajomych');
    realtime.value = { ...realtime.value, state: { streamId: 's', revision: 1, friendRequests: [], friends: [], challenges: [], outgoingChallenges: [], gameSession: null, queued: false } };
    view.unmount();
    mount('/friends', '/friends', <FriendsPage />);
    expect(screen.queryByRole('status', { name: 'Wczytuję znajomych' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Znajdź znajomych' })).toBeInTheDocument();
  });

  it('own profile with its activity and statistics', async () => {
    const profile = gate();
    const activity = gate();
    server.use(
      http.get(`${API_URL}/api/user/me`, async () => { await profile.wait(); return HttpResponse.json(createUser()); }),
      http.get(`${API_URL}/api/user/me/activity`, async () => { await activity.wait(); return HttpResponse.json([]); }),
      http.get(`${API_URL}/api/badges/all`, () => HttpResponse.json([])),
    );
    mount('/profile', '/profile', <ProfilePage />);
    expectSkeleton('Ładowanie profilu');
    await profile.release();
    expect(await screen.findByRole('heading', { name: 'tester' })).toBeInTheDocument();
    expectSkeleton('Ładowanie aktywności');
    expectSkeleton('Ładowanie statystyk');
    await activity.release();
    expect(await screen.findByText('Statystyki pojawią się po pierwszym rozwiązanym pokoju.')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Ładowanie aktywności' })).not.toBeInTheDocument();
  });

  it('profile preview card', async () => {
    const pending = gate();
    server.use(
      http.get(`${API_URL}/api/user/:username`, async () => { await pending.wait(); return HttpResponse.json({ ...createUser(), username: 'ola', points: 120, streak: 2, badges: [] }); }),
      http.get(`${API_URL}/api/friends/stats/:username`, () => HttpResponse.json({ message: 'x' }, { status: 404 })),
    );
    mount('/', '/', <ProfilePeek username="ola" token={createToken()} />);
    act(() => screen.getByRole('link', { name: 'ola' }).focus());
    await screen.findByRole('status', { name: 'Wczytuję profil' });
    const card = expectSkeleton('Wczytuję profil');
    expect(card.tagName).toBe('SPAN');
    await pending.release();
    expect(await screen.findByText(/Poziom/)).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Wczytuję profil' })).not.toBeInTheDocument();
  });
});
