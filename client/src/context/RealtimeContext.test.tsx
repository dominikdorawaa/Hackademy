import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { AuthProvider, useAuth } from './AuthContext';
import { RealtimeProvider, useRealtime } from './RealtimeContext';
import type { RealtimeCallbacks } from '../services/RealtimeConnection';
import type { RealtimeState } from '../types/realtime';
import { createToken } from '../test/fixtures/auth';
import { server } from '../test/mocks/server';
import API_URL from '../apiConfig';
import { MemoryRouter } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ArenaPage from '../pages/ArenaPage';

const connections = vi.hoisted(() => [] as { callbacks: RealtimeCallbacks; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[]);
vi.mock('../services/RealtimeConnection', () => ({
  RealtimeConnection: class {
    start = vi.fn();
    stop = vi.fn();
    constructor(_token: string, public callbacks: RealtimeCallbacks) { connections.push(this); }
  },
}));

const snapshot = (revision = 1, streamId = 'server'): RealtimeState => ({
  revision, streamId, friendRequests: [], friends: [], challenges: [], outgoingChallenges: [], gameSession: null, queued: false,
});

function Consumer({ name }: { name: string }) {
  const { state, connected, synchronize } = useRealtime();
  const { logout, login } = useAuth();
  return <>
    <output data-testid={name}>{state?.revision ?? 'empty'}:{connected ? 'online' : 'offline'}:{state?.friendRequests.length ?? 0}</output>
    <button onClick={logout}>logout {name}</button>
    <button onClick={() => login(createToken('ADMIN'))}>login {name}</button>
    <button onClick={() => void synchronize()}>sync {name}</button>
  </>;
}

function mount() {
  localStorage.setItem('token', createToken());
  render(<AuthProvider><RealtimeProvider><Consumer name="navbar" /><Consumer name="arena" /></RealtimeProvider></AuthProvider>);
}

beforeEach(() => { connections.length = 0; });

describe('shared realtime state', () => {
  it('updates Navbar and Arena together without polling either endpoint', async () => {
    let snapshots = 0;
    let polling = 0;
    server.use(
      http.get(`${API_URL}/api/realtime/state`, () => { snapshots++; return HttpResponse.json(snapshot()); }),
      http.get(`${API_URL}/api/friends/requests`, () => { polling++; return HttpResponse.json([]); }),
      http.get(`${API_URL}/api/arena/challenges`, () => { polling++; return HttpResponse.json([]); }),
      http.get(`${API_URL}/api/arena/status`, () => { polling++; return new HttpResponse(null, { status: 204 }); }),
    );
    localStorage.setItem('token', createToken());
    render(<MemoryRouter initialEntries={['/arena']}><AuthProvider><RealtimeProvider><Navbar /><ArenaPage /></RealtimeProvider></AuthProvider></MemoryRouter>);
    expect(connections).toHaveLength(1);
    act(() => connections[0].callbacks.ready());
    await screen.findByRole('button', { name: 'Powiadomienia' });
    await waitFor(() => expect(snapshots).toBe(1));
    const incoming = { ...snapshot(2), challenges: [{
      id: 'challenge', challengerId: 2, challengerUsername: 'opponent', targetId: 1, targetUsername: 'tester',
      createdAt: '2026-10-11T12:00:00', status: 'PENDING' as const, vpnEnabled: false,
    }] };
    act(() => connections[0].callbacks.state(incoming));
    fireEvent.click(screen.getByRole('button', { name: 'Powiadomienia' }));
    expect(screen.getByText('1 nowe')).toBeInTheDocument();
    expect(screen.getByText('Otrzymane Wyzwania (1)')).toBeInTheDocument();
    act(() => connections[0].callbacks.state(incoming));
    expect(document.querySelectorAll('.notification-item')).toHaveLength(1);
    act(() => connections[0].callbacks.state(snapshot(3)));
    expect(screen.queryByText('Otrzymane Wyzwania (1)')).not.toBeInTheDocument();
    expect(screen.queryByText('1 nowe')).not.toBeInTheDocument();
    act(() => connections[0].callbacks.state({ ...snapshot(4), gameSession: {
      id: 'game', player1Id: 1, player1Username: 'tester', player1Elo: 500,
      player2Id: 2, player2Username: 'opponent', player2Elo: 500, roomId: 7,
      startTime: '2026-10-11T12:00:00', status: 'ACTIVE', winnerId: null,
      player1EloChange: null, player2EloChange: null, hintsUsed: {}, finishTimes: {}, penaltiesInSeconds: {},
    } }));
    expect(screen.getByText('Mecz Znaleziony!')).toBeInTheDocument();
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
    act(() => connections[0].callbacks.state({ ...snapshot(2), friendRequests: [{ id: 7, requesterUsername: 'friend', createdAt: '2026-10-11', avatarSeed: 'friend' }] }));
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
