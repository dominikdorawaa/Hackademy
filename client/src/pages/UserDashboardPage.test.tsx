import { setClerkSession } from '../test/clerk';
import { render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it } from 'vitest';
import API_URL from '../apiConfig';
import { AuthProvider } from '../context/AuthContext';
import { createToken, createUser } from '../test/fixtures/auth';
import { server } from '../test/mocks/server';
import UserDashboardPage from './UserDashboardPage';

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
  expect(screen.getAllByRole('tooltip')).toHaveLength(1);
});

it('keeps the dashboard working when the arena rank is missing', async () => {
  server.use(http.get(`${API_URL}/api/dashboard/summary`, () => HttpResponse.json(summary({ myRank: null }))));
  mount();
  const arena = await screen.findByRole('region', { name: 'Arena' });
  expect(within(arena).getByRole('status')).toHaveTextContent('Nie udało się wczytać rangi areny.');
  expect(screen.getByRole('heading', { name: 'Ostatnio zdobyte flagi' })).toBeInTheDocument();
});
