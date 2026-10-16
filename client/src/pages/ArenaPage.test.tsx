import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import API_URL from '../apiConfig';
import { AuthProvider } from '../context/AuthContext';
import { createToken, createUser } from '../test/fixtures/auth';
import { currentUserUrl } from '../test/mocks/handlers';
import { server } from '../test/mocks/server';
import type { RealtimeState } from '../types/realtime';
import { createGameSession } from '../test/fixtures/arena';
import ArenaPage from './ArenaPage';

const realtime = vi.hoisted(() => ({ value: { state: null as RealtimeState | null, connected: true, error: null, synchronize: vi.fn(async () => {}) } }));
vi.mock('../context/RealtimeContext', () => ({ useRealtime: () => realtime.value }));

const state = (overrides: Partial<RealtimeState> = {}): RealtimeState => ({
  streamId: 's', revision: 1, friendRequests: [], friends: [], challenges: [], outgoingChallenges: [], gameSession: null, queued: false, ...overrides,
});
const incoming = { id: 'c1', challengerId: 2, challengerUsername: 'rywal', targetId: 1, targetUsername: 'tester', createdAt: '2026-10-11T12:00:00', status: 'PENDING' as const };
const mount = () => render(<MemoryRouter><AuthProvider><ArenaPage /></AuthProvider></MemoryRouter>);

beforeEach(() => {
  localStorage.setItem('token', createToken());
  realtime.value = { state: state(), connected: true, error: null, synchronize: vi.fn(async () => {}) };
});

it('locks duels below the server threshold of 500 XP and shows how much XP is missing', async () => {
  server.use(http.get(currentUserUrl, () => HttpResponse.json({ ...createUser(), points: 150 })));
  mount();
  expect(await screen.findByText('Pojedynki odblokujesz od 500 XP. Brakuje Ci 350 XP.')).toBeInTheDocument();
  expect(screen.getByRole('progressbar', { name: 'Postęp do odblokowania Areny' })).toHaveAttribute('aria-valuenow', '150');
  expect(screen.getByRole('link', { name: 'Rozwiązuj pokoje' })).toHaveAttribute('href', '/learn');
  expect(screen.queryByRole('button', { name: 'Znajdź przeciwnika' })).not.toBeInTheDocument();
});

it('shows Elo, its position and friends with their duel record', async () => {
  server.use(
    http.get(currentUserUrl, () => HttpResponse.json({ ...createUser(), points: 900, hasVpnAccess: true })),
    http.get(`${API_URL}/api/ranking/summary`, () => HttpResponse.json({ ranking: [], user: null, myRank: { username: 'tester', points: 900, elo: 1086, rankPoints: 4, rankElo: 9 } })),
    http.get(`${API_URL}/api/friends`, () => HttpResponse.json([{ id: 2, username: 'ola', points: 860, streak: 0 }, { id: 3, username: 'kuba', points: 120, streak: 0 }])),
    http.get(`${API_URL}/api/friends/stats/:name`, ({ params }) => params.name === 'ola'
      ? HttpResponse.json({ id: 2, username: 'ola', points: 860, friendshipStatus: 'FRIENDS', winsAgainst: 2, lossesAgainst: 1 })
      : HttpResponse.json({ message: 'Brak' }, { status: 404 })),
  );
  mount();
  expect(await screen.findByText('1086')).toBeInTheDocument();
  expect(screen.getByText(/#9 w rankingu Elo/)).toBeInTheDocument();
  expect(screen.getByText('Liga Platyna')).toBeInTheDocument();
  for (const minimum of [600, 800, 1000, 1200]) expect(screen.getByText(`od ${minimum} Elo`)).toBeInTheDocument();
  expect(screen.getByText('Do ligi Diament brakuje Ci 114 Elo.')).toBeInTheDocument();
  expect(screen.getByRole('listitem', { current: true })).toHaveTextContent('Platyna');
  expect(await screen.findByText('2:1')).toBeInTheDocument();
  expect(screen.getByText('Bilans niedostępny')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Wszyscy znajomi (2)' })).toHaveAttribute('href', '/friends');
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Zasady pojedynków rankingowych' })).toBeInTheDocument();
});

it('challenges a friend and explains a refused challenge next to the friend', async () => {
  const bodies: unknown[] = [];
  server.use(
    http.get(currentUserUrl, () => HttpResponse.json({ ...createUser(), points: 900 })),
    http.get(`${API_URL}/api/friends`, () => HttpResponse.json([{ id: 2, username: 'ola', points: 860, streak: 0 }, { id: 3, username: 'kuba', points: 120, streak: 0 }])),
    http.get(`${API_URL}/api/friends/stats/:name`, () => HttpResponse.error()),
    http.post(`${API_URL}/api/arena/challenge/create`, async ({ request }) => {
      const body = await request.json() as { targetUsername: string };
      bodies.push(body);
      return body.targetUsername === 'ola' ? HttpResponse.json({ message: 'ok' }) : HttpResponse.json({ message: 'Gracz jest offline.' }, { status: 400 });
    }),
  );
  mount();
  const friendsPanel = (await screen.findByRole('heading', { name: 'Wyzwij znajomego' })).closest('section')!;
  const rows = await within(friendsPanel).findAllByRole('listitem');
  fireEvent.click(within(rows[0]).getByRole('button', { name: 'Wyzwij' }));
  await waitFor(() => expect(realtime.value.synchronize).toHaveBeenCalled());
  fireEvent.click(within(rows[1]).getByRole('button', { name: 'Wyzwij' }));
  expect(await screen.findByText('Gracz jest offline.')).toBeInTheDocument();
  expect(bodies).toEqual([{ targetUsername: 'ola' }, { targetUsername: 'kuba' }]);
});

it('marks friends who already got a challenge and lets the player cancel waiting', async () => {
  realtime.value.state = state({ outgoingChallenges: [{ ...incoming, challengerUsername: 'tester', targetUsername: 'ola' }] });
  let cancelled = false;
  server.use(
    http.get(currentUserUrl, () => HttpResponse.json({ ...createUser(), points: 900 })),
    http.get(`${API_URL}/api/friends`, () => HttpResponse.json([{ id: 2, username: 'ola', points: 860, streak: 0 }])),
    http.get(`${API_URL}/api/friends/stats/:name`, () => HttpResponse.json({ message: 'x' }, { status: 500 })),
    http.post(`${API_URL}/api/arena/challenge/:id/cancel`, () => { cancelled = true; return HttpResponse.json({ message: 'ok' }); }),
  );
  mount();
  expect(await screen.findByText('Oczekiwanie na akceptację wyzwania...')).toBeInTheDocument();
  expect(await screen.findByText('Wyzwanie wysłane')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Anuluj' }));
  await waitFor(() => expect(cancelled).toBe(true));
});

it('accepts and rejects incoming challenges and shows a refused acceptance', async () => {
  realtime.value.state = state({ challenges: [incoming, { ...incoming, id: 'c2', challengerUsername: 'drugi' }] });
  let rejected = false;
  server.use(
    http.get(currentUserUrl, () => HttpResponse.json({ ...createUser(), points: 900 })),
    http.post(`${API_URL}/api/arena/challenge/c1/accept`, () => HttpResponse.json({ message: 'Wyzwanie wygasło.' }, { status: 409 })),
    http.post(`${API_URL}/api/arena/challenge/c2/accept`, () => HttpResponse.json({ id: 'game' })),
    http.post(`${API_URL}/api/arena/challenge/c1/reject`, () => { rejected = true; return HttpResponse.json({ message: 'ok' }); }),
  );
  mount();
  const panel = (await screen.findByRole('heading', { name: 'Otrzymane wyzwania (2)' })).closest('section')!;
  expect(within(panel).getAllByText('Wyzywa Cię na pojedynek')).toHaveLength(2);
  const [first, second] = within(panel).getAllByRole('listitem');
  fireEvent.click(within(first).getByRole('button', { name: 'Akceptuj' }));
  expect(await screen.findByText('Wyzwanie wygasło.')).toBeInTheDocument();
  fireEvent.click(within(second).getByRole('button', { name: 'Akceptuj' }));
  expect(await within(second).findByRole('button', { name: 'Zaakceptowano' })).toBeDisabled();
  expect(within(second).queryByRole('button', { name: 'Odrzuć' })).not.toBeInTheDocument();
  fireEvent.click(within(first).getByRole('button', { name: 'Odrzuć' }));
  await waitFor(() => expect(rejected).toBe(true));
});

it('reports a refused queue join and returns to an active match', async () => {
  server.use(
    http.get(currentUserUrl, () => HttpResponse.json({ ...createUser(), points: 900 })),
    http.post(`${API_URL}/api/arena/join`, () => HttpResponse.json({ message: 'Brak pokoi do pojedynku.' }, { status: 400 })),
  );
  const view = mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Znajdź przeciwnika' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Brak pokoi do pojedynku.');
  realtime.value.state = state({ gameSession: createGameSession({ id: 'g', player1Id: 2, player1Username: 'rywal', player2Id: 1, player2Username: 'tester' }) });
  view.rerender(<MemoryRouter><AuthProvider><ArenaPage /></AuthProvider></MemoryRouter>);
  expect(screen.getByText('Masz trwający mecz z rywal.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Wróć do walki' })).toHaveAttribute('href', '/arena/battle/g');
});

it('explains when friends cannot be loaded', async () => {
  server.use(
    http.get(currentUserUrl, () => HttpResponse.json({ ...createUser(), points: 900 })),
    http.get(`${API_URL}/api/friends`, () => HttpResponse.json({ message: 'x' }, { status: 500 })),
    http.get(`${API_URL}/api/ranking/summary`, () => HttpResponse.error()),
  );
  mount();
  expect(await screen.findByText('Nie udało się wczytać znajomych. Odśwież stronę, żeby spróbować ponownie.')).toBeInTheDocument();
  expect(await screen.findByText('Nie udało się wczytać Elo')).toBeInTheDocument();
  expect(screen.getByText('–')).toBeInTheDocument();
  expect(screen.queryByText(/^Liga /)).not.toBeInTheDocument();
  expect(screen.queryByRole('listitem', { current: true })).not.toBeInTheDocument();
  expect(screen.getByText('Odśwież stronę, żeby spróbować ponownie.')).toBeInTheDocument();
});

it('keeps players at 400 XP locked because the server requires 500', async () => {
  server.use(http.get(currentUserUrl, () => HttpResponse.json({ ...createUser(), points: 400 })));
  mount();
  expect(await screen.findByText('Pojedynki odblokujesz od 500 XP. Brakuje Ci 100 XP.')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Arena od 500 XP' })).toBeInTheDocument();
});

it('shows loading states, then a confirmed empty record separately from an unavailable one', async () => {
  let releaseRank!: () => void;
  let releaseStats!: () => void;
  const rankGate = new Promise<void>(resolve => { releaseRank = resolve; });
  const statsGate = new Promise<void>(resolve => { releaseStats = resolve; });
  server.use(
    http.get(currentUserUrl, () => HttpResponse.json({ ...createUser(), points: 900 })),
    http.get(`${API_URL}/api/ranking/summary`, async () => { await rankGate; return HttpResponse.json({ ranking: [], user: null, myRank: null }); }),
    http.get(`${API_URL}/api/friends`, () => HttpResponse.json([{ id: 2, username: 'ola', points: 860, streak: 0 }])),
    http.get(`${API_URL}/api/friends/stats/:name`, async () => { await statsGate; return HttpResponse.json({ id: 2, username: 'ola', points: 860, friendshipStatus: 'FRIENDS', winsAgainst: 0, lossesAgainst: 0 }); }),
  );
  mount();
  expect(await screen.findByText('Wczytuję Elo…')).toBeInTheDocument();
  expect(await screen.findByText('Wczytuję bilans…')).toBeInTheDocument();
  releaseStats();
  expect(await screen.findByText('Jeszcze bez pojedynku')).toBeInTheDocument();
  releaseRank();
  expect(await screen.findByText('Nie udało się wczytać Elo')).toBeInTheDocument();
});
