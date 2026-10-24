import { setClerkSession } from '../test/clerk';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { AuthProvider, useAuth } from './AuthContext';
import { RealtimeProvider, useRealtime } from './RealtimeContext';
import type { RealtimeCallbacks } from '../services/RealtimeConnection';
import type { RealtimeState } from '../types/realtime';
import type { GameSession } from '../types/api';
import { createToken, createUser } from '../test/fixtures/auth';
import { server } from '../test/mocks/server';
import API_URL from '../apiConfig';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import RealtimeGameNavigation from '../components/RealtimeGameNavigation';
import Navbar from '../components/Navbar';
import { ThemeProvider } from './ThemeContext';
import ArenaPage from '../pages/ArenaPage';
import FriendsPage from '../pages/FriendsPage';
import * as httpService from '../services/http';
import { createGameSession } from '../test/fixtures/arena';

const connections = vi.hoisted(() => [] as { callbacks: RealtimeCallbacks; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[]);
vi.mock('../services/RealtimeConnection', () => ({
  RealtimeConnection: class {
    start = vi.fn();
    stop = vi.fn();
    constructor(_token: string, public callbacks: RealtimeCallbacks) { connections.push(this); }
  },
}));

const snapshot = (revision = 1, streamId = 'server'): RealtimeState => ({
  revision, streamId, friendRequests: [], friends: [], challenges: [], outgoingChallenges: [], expiredChallenges: [], serverTime: 0, gameSession: null, queued: false,
});

const game = (id = 'game', status: GameSession['status'] = 'ACTIVE'): GameSession => createGameSession({ id, status });

function Consumer({ name }: { name: string }) {
  const { state, connected, synchronize } = useRealtime();
  const { logout } = useAuth();
  return <>
    <output data-testid={name}>{state?.revision ?? 'empty'}:{connected ? 'online' : 'offline'}:{state?.friendRequests.length ?? 0}</output>
    <button onClick={logout}>logout {name}</button>
    <button onClick={() => setClerkSession(createToken('ADMIN'))}>login {name}</button>
    <button onClick={() => void synchronize()}>sync {name}</button>
  </>;
}

function mount() {
  setClerkSession(createToken());
  render(<AuthProvider><RealtimeProvider><Consumer name="navbar" /><Consumer name="arena" /></RealtimeProvider></AuthProvider>);
}

function GameLocation() {
  const location = useLocation();
  return <output data-testid="game-location">{location.pathname}{location.search}</output>;
}

beforeEach(() => { connections.length = 0; });

describe('shared realtime state', () => {
  it('keeps the existing live snapshot when the visible tab resumes', async () => {
    let requests = 0;
    server.use(http.get(`${API_URL}/api/realtime/state`, () => { requests++; return HttpResponse.json(snapshot()); }));
    mount();
    act(() => connections[0].callbacks.ready());
    await waitFor(() => expect(screen.getByTestId('arena')).toHaveTextContent('1:online'));
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(requests).toBe(1);
  });
  it('offers a route back to an active match after leaving its room', async () => {
    server.use(
      http.get(`${API_URL}/api/user/me`, () => HttpResponse.json({ ...createUser(), points: 500 })),
      http.get(`${API_URL}/api/realtime/state`, () => HttpResponse.json({ ...snapshot(), gameSession: game() })),
    );
    setClerkSession(createToken());
    render(<MemoryRouter initialEntries={['/arena']}><AuthProvider><RealtimeProvider>
      <RealtimeGameNavigation /><GameLocation />
      <Routes>
        <Route path="/arena" element={<ArenaPage />} />
        <Route path="/arena/battle/:gameId" element={<Link to="/arena">Powrót</Link>} />
      </Routes>
    </RealtimeProvider></AuthProvider></MemoryRouter>);
    act(() => connections[0].callbacks.ready());
    fireEvent.click(await screen.findByRole('link', { name: 'Powrót' }));
    const returnLink = await screen.findByRole('link', { name: 'Wróć do walki' });
    expect(returnLink).toHaveAttribute('href', '/arena/battle/game');
    expect(screen.queryByRole('button', { name: 'Znajdź przeciwnika' })).not.toBeInTheDocument();
    fireEvent.click(returnLink);
    expect(screen.getByTestId('game-location')).toHaveTextContent('/arena/battle/game');
  });


  it.each(['join', 'synchronization'])('allows canceling a confirmed queue while the %s response is pending', async stalled => {
    let requests = 0;
    let release: (() => void) | undefined;
    let left = false;
    server.use(
      http.get(`${API_URL}/api/user/me`, () => HttpResponse.json({ ...createUser(), points: 500 })),
      http.get(`${API_URL}/api/realtime/state`, async () => {
        if (++requests > 1 && stalled === 'synchronization') await new Promise<void>(resolve => { release = resolve; });
        return HttpResponse.json(snapshot());
      }),
      http.post(`${API_URL}/api/arena/join`, async () => {
        if (stalled === 'join') await new Promise<void>(resolve => { release = resolve; });
        return HttpResponse.json({ message: 'Joined' });
      }),
      http.post(`${API_URL}/api/arena/leave`, () => { left = true; return HttpResponse.json({ message: 'Left' }); }),
    );
    setClerkSession(createToken());
    render(<MemoryRouter><AuthProvider><RealtimeProvider><ArenaPage /></RealtimeProvider></AuthProvider></MemoryRouter>);
    act(() => connections[0].callbacks.ready());
    const join = await screen.findByRole('button', { name: 'Znajdź przeciwnika' });
    expect(screen.getByRole('link', { name: 'Zmień swój awatar' })).toHaveAttribute('href', '/arena/avatar');
    await waitFor(() => expect(join).toBeEnabled());
    fireEvent.click(join);
    try {
      await waitFor(() => expect(release).toBeDefined());
      act(() => connections[0].callbacks.state({ ...snapshot(2), queued: true }));
      expect(screen.getByText('Szukanie przeciwnika...')).toBeInTheDocument();
      const cancel = screen.getByRole('button', { name: 'Anuluj' });
      expect(cancel).toBeEnabled();
      fireEvent.click(cancel);
      await waitFor(() => expect(left).toBe(true));
      act(() => connections[0].callbacks.state(snapshot(3)));
    } finally {
      await act(async () => release?.());
    }
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Anuluj' })).not.toBeInTheDocument());
  });

  it('shows a recoverable error on Friends instead of indefinite loading', async () => {
    let successful = false;
    let requests = 0;
    server.use(http.get(`${API_URL}/api/realtime/state`, () => {
      requests++;
      return successful ? HttpResponse.json(snapshot()) : new HttpResponse(null, { status: 503 });
    }));
    setClerkSession(createToken());
    render(<MemoryRouter><AuthProvider><RealtimeProvider><FriendsPage /></RealtimeProvider></AuthProvider></MemoryRouter>);
    act(() => connections[0].callbacks.ready());
    expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się pobrać danych');
    expect(screen.queryByRole('status', { name: 'Wczytuję znajomych' })).not.toBeInTheDocument();
    successful = true;
    fireEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(requests).toBe(2);
    expect(screen.getByText('Znajomi')).toBeInTheDocument();
  });

  it('bounds automatic retries and resets the budget on manual synchronization', async () => {
    const request = vi.spyOn(httpService, 'request').mockResolvedValue(
      new Response(null, { status: 503 }) as httpService.ApiResponse<unknown>);
    vi.useFakeTimers();
    try {
      mount();
      await act(async () => connections[0].callbacks.ready());
      expect(request.mock.calls.filter(([path]) => path === '/api/realtime/state')).toHaveLength(1);
      for (const delay of [2000, 4000, 8000, 16000, 30000]) {
        await act(async () => { await vi.advanceTimersByTimeAsync(delay); });
      }
      expect(request.mock.calls.filter(([path]) => path === '/api/realtime/state')).toHaveLength(6);
      await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
      expect(request.mock.calls.filter(([path]) => path === '/api/realtime/state')).toHaveLength(6);
      await act(async () => fireEvent.click(screen.getByText('sync navbar')));
      expect(request.mock.calls.filter(([path]) => path === '/api/realtime/state')).toHaveLength(7);
      request.mockResolvedValue(new Response(JSON.stringify(snapshot())) as httpService.ApiResponse<unknown>);
      await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
      expect(request.mock.calls.filter(([path]) => path === '/api/realtime/state')).toHaveLength(8);
      expect(screen.getByTestId('navbar')).toHaveTextContent('1:online');
    } finally {
      vi.useRealTimers();
      request.mockRestore();
    }
  });

  it('updates Navbar and Arena together without polling either endpoint', async () => {
    let snapshots = 0;
    let polling = 0;
    server.use(
      http.get(`${API_URL}/api/user/me`, () => HttpResponse.json({ ...createUser(), points: 500 })),
      http.get(`${API_URL}/api/realtime/state`, () => { snapshots++; return HttpResponse.json(snapshot()); }),
      http.get(`${API_URL}/api/friends/requests`, () => { polling++; return HttpResponse.json([]); }),
      http.get(`${API_URL}/api/arena/challenges`, () => { polling++; return HttpResponse.json([]); }),
      http.get(`${API_URL}/api/arena/status`, () => { polling++; return new HttpResponse(null, { status: 204 }); }),
    );
    setClerkSession(createToken());
    render(<ThemeProvider><MemoryRouter initialEntries={['/arena']}><AuthProvider><RealtimeProvider><RealtimeGameNavigation /><GameLocation /><Navbar /><ArenaPage /></RealtimeProvider></AuthProvider></MemoryRouter></ThemeProvider>);
    expect(connections).toHaveLength(1);
    expect(await screen.findByRole('button', { name: 'Znajdź przeciwnika' })).toBeDisabled();
    expect(screen.getByText('Łączenie z Areną. Poczekaj na połączenie z serwerem.')).toBeInTheDocument();
    act(() => connections[0].callbacks.ready());
    await screen.findByRole('button', { name: 'Powiadomienia' });
    await waitFor(() => expect(snapshots).toBe(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Znajdź przeciwnika' })).toBeEnabled());
    act(() => connections[0].callbacks.state({ ...snapshot(2), queued: true }));
    expect(screen.getByText('Szukanie przeciwnika...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anuluj' })).toBeInTheDocument();
    const incoming = { ...snapshot(3), challenges: [{
      id: 'challenge', challengerId: 2, challengerUsername: 'opponent', targetId: 1, targetUsername: 'tester',
      createdAt: '2026-10-11T12:00:00', status: 'PENDING' as const, expiresAt: 1_060_000,
    }] };
    act(() => connections[0].callbacks.state(incoming));
    fireEvent.click(screen.getByRole('button', { name: 'Powiadomienia' }));
    expect(screen.getByText('1 nowe')).toBeInTheDocument();
    expect(screen.getByText('Otrzymane wyzwania (1)')).toBeInTheDocument();
    act(() => connections[0].callbacks.state(incoming));
    expect(document.querySelectorAll('.notification-item')).toHaveLength(1);
    act(() => connections[0].callbacks.state(snapshot(4)));
    expect(screen.queryByText('Otrzymane wyzwania (1)')).not.toBeInTheDocument();
    expect(screen.queryByText('1 nowe')).not.toBeInTheDocument();
    act(() => connections[0].callbacks.state({ ...snapshot(5), gameSession: game() }));
    expect(screen.getByTestId('game-location')).toHaveTextContent('/arena/battle/game');
    vi.useFakeTimers();
    await act(async () => { vi.advanceTimersByTime(60000); });
    vi.useRealTimers();
    expect(polling).toBe(0);
    expect(snapshots).toBe(1);
  });

  it('uses one connection and initial request for two consumers and applies events without HTTP polling', async () => {
    let requests = 0;
    server.use(http.get(`${API_URL}/api/realtime/state`, () => { requests++; return HttpResponse.json(snapshot()); }));
    mount();
    expect(connections).toHaveLength(1);
    await act(async () => connections[0].callbacks.ready());
    await waitFor(() => expect(screen.getByTestId('arena')).toHaveTextContent('1:online:0'));
    act(() => connections[0].callbacks.state({ ...snapshot(2), friendRequests: [{ id: 7, requesterUsername: 'friend', createdAt: '2026-10-11' }] }));
    expect(screen.getByTestId('navbar')).toHaveTextContent('2:online:1');
    expect(screen.getByTestId('arena')).toHaveTextContent('2:online:1');
    vi.useFakeTimers();
    await act(async () => { vi.advanceTimersByTime(60000); });
    vi.useRealTimers();
    expect(requests).toBe(1);
  });

  it('ignores duplicate and older snapshots including a late HTTP response', async () => {
    let release: (() => void) | undefined;
    server.use(http.get(`${API_URL}/api/realtime/state`, async () => {
      await new Promise<void>(resolve => { release = resolve; });
      return HttpResponse.json(snapshot(1));
    }));
    mount();
    act(() => connections[0].callbacks.ready());
    await waitFor(() => expect(release).toBeDefined());
    act(() => {
      connections[0].callbacks.state(snapshot(3));
      connections[0].callbacks.state({ ...snapshot(3), queued: true });
      connections[0].callbacks.state(snapshot(2));
    });
    await act(async () => release?.());
    expect(screen.getByTestId('arena')).toHaveTextContent('3:online:0');
  });

  it('resynchronizes after reconnect and accepts a new server stream', async () => {
    let current = snapshot(9); let requests = 0;
    server.use(http.get(`${API_URL}/api/realtime/state`, () => { requests++; return HttpResponse.json(current); }));
    mount();
    act(() => connections[0].callbacks.ready());
    await waitFor(() => expect(screen.getByTestId('arena')).toHaveTextContent('9:online'));
    act(() => connections[0].callbacks.disconnected());
    expect(screen.getByTestId('arena')).toHaveTextContent('9:offline');
    current = { ...snapshot(1, 'restarted-server'), queued: true };
    act(() => connections[0].callbacks.ready());
    await waitFor(() => expect(screen.getByTestId('arena')).toHaveTextContent('1:online'));
    expect(connections).toHaveLength(1);
    expect(requests).toBe(2);
  });

  it('closes on logout and never exposes the previous account state', async () => {
    server.use(http.get(`${API_URL}/api/realtime/state`, () => HttpResponse.json(snapshot(5))));
    mount();
    act(() => connections[0].callbacks.ready());
    await waitFor(() => expect(screen.getByTestId('arena')).toHaveTextContent('5:online'));
    fireEvent.click(screen.getByText('logout navbar'));
    expect(connections[0].stop).toHaveBeenCalledOnce();
    act(() => connections[0].callbacks.state(snapshot(6)));
    expect(screen.getByTestId('arena')).toHaveTextContent('empty:offline');
    fireEvent.click(screen.getByText('login navbar'));
    expect(connections).toHaveLength(2);
    expect(screen.getByTestId('arena')).toHaveTextContent('empty:offline');
  });

  it('combines simultaneous synchronization requests into one', async () => {
    let requests = 0;
    server.use(http.get(`${API_URL}/api/realtime/state`, async () => { requests++; return HttpResponse.json(snapshot()); }));
    mount();
    act(() => {
      connections[0].callbacks.ready();
      fireEvent.click(screen.getByText('sync navbar'));
      fireEvent.click(screen.getByText('sync arena'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(screen.getByTestId('arena')).toHaveTextContent('1:online'));
    expect(requests).toBe(1);
  });
});
