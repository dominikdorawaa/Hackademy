import { setClerkSession } from '../test/clerk';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import API_URL from '../apiConfig';
import { AuthProvider } from '../context/AuthContext';
import { createToken, createUser } from '../test/fixtures/auth';
import { server } from '../test/mocks/server';
import UserDashboardPage from './UserDashboardPage';
import * as userApi from '../services/userApi';
import type { ApiResponse } from '../services/http';

const user = createUser();
const summary = (overrides: Record<string, unknown> = {}) => ({
  user: { ...user, points: 1400 },
  ranking: [],
  myRank: { username: user.username, points: 1400, elo: 857, rankPoints: 4, rankElo: 12 },
  recentSolved: [{ roomId: 7, title: 'Pierwsza flaga', points: 80, solvedAt: '2026-10-20T10:00:00' }],
  pathsProgress: [],
  ...overrides,
});
const mount = () => render(<MemoryRouter><AuthProvider><UserDashboardPage /></AuthProvider></MemoryRouter>);

beforeEach(() => {
  setClerkSession(createToken());
  server.use(
    http.get(`${API_URL}/api/user/me/recent-solved`, () => HttpResponse.json([])),
    http.post(`${API_URL}/api/user/me/active-time`, () => HttpResponse.json({ secondsThisWeek: 0 })),
  );
});

it('shows the arena panel next to the recent flags and keeps Elo out of the XP rank', async () => {
  server.use(http.get(`${API_URL}/api/dashboard/summary`, () => HttpResponse.json(summary())));
  mount();
  const arena = await screen.findByRole('region', { name: 'Arena' });
  expect(within(arena).getByText('Liga Exploit')).toBeInTheDocument();
  expect(within(arena).getByText('#12')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Ostatnio zdobyte flagi' })).toBeInTheDocument();
  expect(screen.getByText('w rankingu XP')).toBeInTheDocument();
  expect(document.querySelector('.ud-rank')).toHaveTextContent('#4');
  expect(screen.getAllByRole('button', { name: 'Co oznacza Elo?' })).toHaveLength(1);
});

it('keeps the dashboard working when the arena rank is missing', async () => {
  server.use(http.get(`${API_URL}/api/dashboard/summary`, () => HttpResponse.json(summary({ myRank: null }))));
  mount();
  const arena = await screen.findByRole('region', { name: 'Arena' });
  expect(within(arena).getByRole('status')).toHaveTextContent('Nie udało się wczytać rangi areny.');
  expect(screen.getByRole('heading', { name: 'Ostatnio zdobyte flagi' })).toBeInTheDocument();
});

it('makes one activity request per idle minute and refreshes recent rooms once on return', async () => {
  let pulses = 0;
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  vi.spyOn(userApi, 'addActiveTime').mockImplementation(async () => {
    pulses++;
    return new Response(JSON.stringify({ secondsThisWeek: 0 }), { status: 200 }) as ApiResponse<{ secondsThisWeek: number }>;
  });
  let recent = 0;
  server.use(
    http.get(`${API_URL}/api/dashboard/summary`, () => HttpResponse.json(summary())),
    http.get(`${API_URL}/api/user/me/recent-solved`, () => { recent++; return HttpResponse.json([]); }),
    http.post(`${API_URL}/api/user/me/active-time`, () => { pulses++; return HttpResponse.json({ secondsThisWeek: 0 }); }),
  );
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const view = mount();
  await screen.findByRole('region', { name: 'Arena' });
  await waitFor(() => expect(pulses).toBe(1));
  expect(recent).toBe(0);
  try {
    await act(async () => { await vi.advanceTimersByTimeAsync(180_000); });
    expect(pulses).toBe(4);
    expect(recent).toBe(0);
  } finally { vi.useRealTimers(); }
  fireEvent(document, new Event('visibilitychange'));
  fireEvent.focus(window);
  await waitFor(() => expect(recent).toBe(1));
  view.unmount();
});
