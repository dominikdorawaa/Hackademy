import { setClerkSession } from '../test/clerk';
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
import { DEFAULT_AVATAR, toAvatarConfig } from '../components/arena/avatar/avatarModel';
import { AVATAR_ATLASES } from '../components/arena/avatar/fighters';
import ArenaPage from './ArenaPage';

const realtime = vi.hoisted(() => ({ value: { state: null as RealtimeState | null, connected: true, error: null, synchronize: vi.fn(async () => {}) } }));
vi.mock('../context/RealtimeContext', () => ({ useRealtime: () => realtime.value }));

const state = (overrides: Partial<RealtimeState> = {}): RealtimeState => ({
  streamId: 's', revision: 1, friendRequests: [], friends: [], challenges: [], outgoingChallenges: [], gameSession: null, queued: false, ...overrides,
});
const incoming = { id: 'c1', challengerId: 2, challengerUsername: 'rywal', targetId: 1, targetUsername: 'tester', createdAt: '2026-10-11T12:00:00', status: 'PENDING' as const };
const mount = () => render(<MemoryRouter><AuthProvider><ArenaPage /></AuthProvider></MemoryRouter>);

beforeEach(() => {
  setClerkSession(createToken());
  realtime.value = { state: state(), connected: true, error: null, synchronize: vi.fn(async () => {}) };
});

it('lets a player with no XP look for an opponent', async () => {
  server.use(http.get(currentUserUrl, () => HttpResponse.json({ ...createUser(), points: 0 })));
  mount();
  expect(await screen.findByRole('button', { name: 'Znajdź przeciwnika' })).toBeEnabled();
  expect(screen.getByRole('heading', { name: 'Wejdź na arenę' })).toBeInTheDocument();
  expect(screen.getByText(/Twój awatar staje do walki na pytania/)).toBeInTheDocument();
  expect(screen.queryByText(/XP\. Brakuje Ci/)).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Rozwiązuj pokoje' })).not.toBeInTheDocument();
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
  expect(screen.getByText('Liga Root')).toBeInTheDocument();
  for (const minimum of [600, 800, 1000, 1200]) expect(screen.getByText(`od ${minimum} Elo`)).toBeInTheDocument();
  expect(screen.getByText('Do ligi Zero-day brakuje Ci 114 Elo.')).toBeInTheDocument();
  expect(screen.getByRole('listitem', { current: true })).toHaveTextContent('Root');
  expect(document.querySelector('.arena-league .league-icon')).toHaveAttribute('data-league', 'root');
  expect(screen.getByRole('listitem', { current: true }).querySelector('.league-icon')).toHaveAttribute('data-glint', 'true');
  expect(document.querySelectorAll('.arena-ladder .league-icon')).toHaveLength(5);
  expect(document.querySelectorAll('.arena-ladder .league-icon[data-glint="true"]')).toHaveLength(1);
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

it('keeps the queue open while a challenge waits and lets the player take it back', async () => {
  realtime.value.state = state({ outgoingChallenges: [{ ...incoming, challengerUsername: 'tester', targetUsername: 'ola' }] });
  let cancelled = false;
  server.use(
    http.get(currentUserUrl, () => HttpResponse.json({ ...createUser(), points: 900 })),
    http.get(`${API_URL}/api/friends`, () => HttpResponse.json([{ id: 2, username: 'ola', points: 860, streak: 0 }])),
    http.get(`${API_URL}/api/friends/stats/:name`, () => HttpResponse.json({ message: 'x' }, { status: 500 })),
    http.post(`${API_URL}/api/arena/challenge/:id/cancel`, () => { cancelled = true; return HttpResponse.json({ message: 'ok' }); }),
  );
  mount();
  const sent = await screen.findByRole('list', { name: 'Wysłane wyzwania' });
  expect(sent).toHaveTextContent('Czekasz na odpowiedź od ola');
  expect(await screen.findByText('Wyzwanie wysłane')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Znajdź przeciwnika' })).toBeEnabled();
  fireEvent.click(within(sent).getByRole('button', { name: 'Cofnij' }));
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

it('lets a player with no XP challenge a friend', async () => {
  const bodies: unknown[] = [];
  server.use(
    http.get(currentUserUrl, () => HttpResponse.json({ ...createUser(), points: 0 })),
    http.get(`${API_URL}/api/friends`, () => HttpResponse.json([{ id: 2, username: 'ola', points: 860, streak: 0 }])),
    http.get(`${API_URL}/api/friends/stats/:name`, () => HttpResponse.error()),
    http.post(`${API_URL}/api/arena/challenge/create`, async ({ request }) => { bodies.push(await request.json()); return HttpResponse.json({ message: 'ok' }); }),
  );
  mount();
  const friendsPanel = (await screen.findByRole('heading', { name: 'Wyzwij znajomego' })).closest('section')!;
  const challenge = await within(friendsPanel).findByRole('button', { name: 'Wyzwij' });
  expect(challenge).toBeEnabled();
  fireEvent.click(challenge);
  await waitFor(() => expect(bodies).toEqual([{ targetUsername: 'ola' }]));
});

it('runs the player avatar while the account loads and offers a retry when it fails', async () => {
  let failing = true;
  let releaseFailure!: () => void;
  let releaseRetry!: () => void;
  const failure = new Promise<void>(resolve => { releaseFailure = resolve; });
  const retry = new Promise<void>(resolve => { releaseRetry = resolve; });
  server.use(http.get(currentUserUrl, async () => {
    if (failing) { await failure; return HttpResponse.json({ message: 'awaria' }, { status: 503 }); }
    await retry;
    return HttpResponse.json({ ...createUser(), points: 900 });
  }));
  mount();
  const loader = screen.getByRole('status', { name: 'Ładowanie Areny' });
  expect(loader.querySelector('.avatar-sprite')).not.toBeNull();
  releaseFailure();
  expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się wczytać Twojego konta.');
  expect(screen.queryByRole('status', { name: 'Ładowanie Areny' })).not.toBeInTheDocument();
  failing = false;
  fireEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
  expect(await screen.findByRole('status', { name: 'Ładowanie Areny' })).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Spróbuj ponownie' })).not.toBeInTheDocument();
  releaseRetry();
  expect(await screen.findByRole('button', { name: 'Znajdź przeciwnika' })).toBeInTheDocument();
});

it('drops the old account error while a new session loads the Arena', async () => {
  const second = createToken('USER', Math.floor(Date.now() / 1000) + 7200);
  let releaseSecond!: () => void;
  const pending = new Promise<void>(resolve => { releaseSecond = resolve; });
  server.use(http.get(currentUserUrl, async ({ request }) => {
    if (request.headers.get('Authorization') !== `Bearer ${second}`) return HttpResponse.json({ message: 'awaria' }, { status: 503 });
    await pending;
    return HttpResponse.json({ ...createUser(), points: 900 });
  }));
  const SwitchAccount = () => { return <button type="button" onClick={() => setClerkSession(second)}>Przełącz konto</button>; };
  render(<MemoryRouter><AuthProvider><SwitchAccount /><ArenaPage /></AuthProvider></MemoryRouter>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się wczytać Twojego konta.');
  fireEvent.click(screen.getByRole('button', { name: 'Przełącz konto' }));
  expect(await screen.findByRole('status', { name: 'Ładowanie Areny' })).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  releaseSecond();
  expect(await screen.findByRole('button', { name: 'Znajdź przeciwnika' })).toBeInTheDocument();
});

it('shows placeholder rows while friends load', async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  server.use(
    http.get(currentUserUrl, () => HttpResponse.json({ ...createUser(), points: 900 })),
    http.get(`${API_URL}/api/friends`, async () => { await gate; return HttpResponse.json([]); }),
  );
  mount();
  const rows = await screen.findByRole('status', { name: 'Wczytuję znajomych' });
  expect(rows.querySelectorAll('.ud-friend')).toHaveLength(3);
  release();
  expect(await screen.findByText(/Nie masz jeszcze znajomych/)).toBeInTheDocument();
  expect(screen.queryByRole('status', { name: 'Wczytuję znajomych' })).not.toBeInTheDocument();
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

it('runs the player avatar while searching for an opponent and keeps the status announced', async () => {
  realtime.value = { ...realtime.value, state: state({ queued: true }) };
  server.use(http.get(currentUserUrl, () => HttpResponse.json({ ...createUser(), points: 900, avatar: toAvatarConfig({ ...DEFAULT_AVATAR, outfit: 'dres' }) })));
  mount();
  const waiting = await screen.findByText('Szukanie przeciwnika...');
  expect(waiting).toHaveAttribute('role', 'status');
  const runner = document.querySelector('.arena-search .arena-runner')!;
  expect(runner).toHaveAttribute('aria-hidden', 'true');
  expect(runner.querySelector('image')).toHaveAttribute('href', AVATAR_ATLASES.dres.atlas);
  expect(screen.getByRole('button', { name: 'Anuluj' })).toBeEnabled();
});

it('does not show the runner when the player is not searching', async () => {
  server.use(http.get(currentUserUrl, () => HttpResponse.json({ ...createUser(), points: 900 })));
  mount();
  expect(await screen.findByRole('button', { name: 'Znajdź przeciwnika' })).toBeInTheDocument();
  expect(document.querySelector('.arena-runner')).toBeNull();
});

it('starts running as soon as the player asks to join the queue', async () => {
  let releaseJoin: () => void = () => {};
  const joined = new Promise<void>(resolve => { releaseJoin = resolve; });
  server.use(
    http.get(currentUserUrl, () => HttpResponse.json({ ...createUser(), points: 900 })),
    http.post(`${API_URL}/api/arena/join`, async () => { await joined; return HttpResponse.json({ message: 'ok' }); }),
  );
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Znajdź przeciwnika' }));
  expect(await screen.findByText('Dołączanie do kolejki...')).toHaveAttribute('role', 'status');
  expect(document.querySelector('.arena-search .arena-runner')).toHaveAttribute('aria-hidden', 'true');
  expect(screen.getByRole('button', { name: 'Anuluj' })).toBeDisabled();
  releaseJoin();
});
