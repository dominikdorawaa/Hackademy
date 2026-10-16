import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import API_URL from '../apiConfig';
import { AuthProvider } from '../context/AuthContext';
import { createGameSession } from '../test/fixtures/arena';
import { createToken, createUser } from '../test/fixtures/auth';
import { currentUserUrl } from '../test/mocks/handlers';
import { server } from '../test/mocks/server';
import type { GameSession } from '../types/api';
import type { RealtimeState } from '../types/realtime';
import ArenaBattlePage from './ArenaBattlePage';

const realtime = vi.hoisted(() => ({ value: { state: null as RealtimeState | null, connected: true, error: null, synchronize: async () => {} } }));
vi.mock('../context/RealtimeContext', () => ({ useRealtime: () => realtime.value }));
vi.mock('../components/arena/avatar/useAvatarAtlas', () => ({ useAvatarAtlas: () => ({ atlas: 'blob:test-atlas', front: null }), useAvatarPortrait: () => null }));

const live = (gameSession: GameSession): RealtimeState => ({
  streamId: 's', revision: 1, friendRequests: [], friends: [], challenges: [], outgoingChallenges: [], gameSession, queued: false,
});
const mount = () => render(<MemoryRouter initialEntries={['/arena/battle/game']}><AuthProvider>
  <Routes><Route path="/arena/battle/:gameId" element={<ArenaBattlePage />} /></Routes>
</AuthProvider></MemoryRouter>);

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  localStorage.setItem('token', createToken());
  realtime.value = { ...realtime.value, state: live(createGameSession()) };
  server.use(
    http.get(currentUserUrl, () => HttpResponse.json(createUser())),
    http.get(`${API_URL}/api/arena/game/:id`, () => HttpResponse.json(createGameSession())),
    http.get(`${API_URL}/api/chat/:id`, () => HttpResponse.json([])),
  );
});

it('shows both fighters, the question and the timer, and sends one answer', async () => {
  let body: unknown = null;
  server.use(http.post(`${API_URL}/api/arena/game/game/answer`, async ({ request }) => { body = await request.json(); return HttpResponse.json({ message: 'ok' }); }));
  mount();
  expect(await screen.findByRole('heading', { name: 'Na którym porcie domyślnie działa SSH?' })).toBeInTheDocument();
  expect(screen.getByText('tester (Ty)')).toBeInTheDocument();
  expect(screen.getByText('opponent')).toBeInTheDocument();
  expect(screen.getByText('Runda 1/10')).toBeInTheDocument();
  expect(screen.getByRole('timer')).toHaveTextContent('15');
  expect(screen.getByRole('meter', { name: 'HP: tester' })).toHaveAttribute('aria-valuenow', '100');
  expect(screen.getByRole('img', { name: 'Twój awatar, tester' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /22/ }));
  await waitFor(() => expect(body).toEqual({ answer: 1 }));
  expect(screen.getByRole('button', { name: /22/ })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: /21/ })).toBeDisabled();
  expect(screen.getByText('Odpowiedź wysłana. Czekamy na rywala.')).toBeInTheDocument();
});

it('shows a refused answer and lets the player try again', async () => {
  server.use(http.post(`${API_URL}/api/arena/game/game/answer`, () => HttpResponse.json({ message: 'Czas na odpowiedź minął.' }, { status: 400 })));
  realtime.value = { ...realtime.value, state: live(createGameSession({ answeredBy: [2] })) };
  mount();
  expect(await screen.findByText('Rywal już odpowiedział.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /23/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Czas na odpowiedź minął.');
  expect(screen.getByRole('button', { name: /23/ })).toBeEnabled();
});

it('reveals the correct answer, both choices and who hit', async () => {
  realtime.value = { ...realtime.value, state: live(createGameSession({
    phase: 'REVEAL', question: null, hp: { 1: 100, 2: 80 }, nextRoundAt: 1_003_000,
    lastRound: { round: 1, questionId: 11, content: 'Na którym porcie domyślnie działa SSH?', answers: ['21', '22', '23', '25'],
      correctAnswer: 1, choices: { 1: 1, 2: 3 }, damage: { 1: 0, 2: 20 } },
  })) };
  mount();
  expect(await screen.findByText('Trafiasz! Rywal traci 20 HP.')).toBeInTheDocument();
  const answers = screen.getAllByRole('listitem');
  expect(within(answers[1]).getByText('Poprawna')).toBeInTheDocument();
  expect(within(answers[1]).getByText('Ty')).toBeInTheDocument();
  expect(within(answers[3]).getByText('opponent')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('meter', { name: 'HP: opponent' })).toHaveAttribute('aria-valuenow', '80'));
  expect(screen.getByRole('timer', { name: 'Następna runda za' })).toHaveTextContent('3');
  expect(screen.getByTestId('fireball-me')).toHaveTextContent('-20');
  expect(screen.queryByTestId('fireball-rival')).not.toBeInTheDocument();
});

it('hides the fireballs when the player asked for reduced motion', async () => {
  localStorage.setItem('app-reduced-motion', 'true');
  realtime.value = { ...realtime.value, state: live(createGameSession({
    phase: 'REVEAL', question: null,
    lastRound: { round: 1, questionId: 11, content: 'Pytanie', answers: ['A', 'B', 'C', 'D'], correctAnswer: 1, choices: { 1: 1, 2: 0 }, damage: { 1: 0, 2: 20 } },
  })) };
  mount();
  await screen.findByText('Trafiasz! Rywal traci 20 HP.');
  expect(screen.queryByTestId('fireball-me')).not.toBeInTheDocument();
  expect(document.querySelector('.battle-page')).toHaveAttribute('data-still', 'true');
});

it('shows the result with the Elo change when the battle ends', async () => {
  realtime.value = { ...realtime.value, state: live(createGameSession({
    status: 'FINISHED', winnerId: 1, finishReason: 'KNOCKOUT', player1EloChange: 16, player2EloChange: -16, hp: { 1: 40, 2: 0 },
  })) };
  mount();
  expect(await screen.findByRole('heading', { name: 'Zwycięstwo' })).toBeInTheDocument();
  expect(screen.getByText('Rywal padł po Twoim ciosie.')).toBeInTheDocument();
  expect(screen.getByText('+16 Elo')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Wróć do Areny' })).toHaveAttribute('href', '/arena');
  expect(screen.queryByRole('button', { name: 'Poddaj walkę' })).not.toBeInTheDocument();
  expect(screen.queryByRole('timer')).not.toBeInTheDocument();
});

it('asks before surrendering and reports a failed surrender', async () => {
  let surrendered = 0;
  server.use(http.post(`${API_URL}/api/arena/game/game/surrender`, () => { surrendered++; return HttpResponse.json({ message: 'nie' }, { status: 500 }); }));
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Poddaj walkę' }));
  fireEvent.click(screen.getByRole('button', { name: 'Walczę dalej' }));
  expect(surrendered).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: 'Poddaj walkę' }));
  expect(screen.getByText('Poddanie oznacza porażkę.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Tak, poddaję walkę' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się poddać walki.');
  expect(surrendered).toBe(1);
});

it('waits for the battle before showing it', async () => {
  realtime.value = { ...realtime.value, state: null };
  server.use(http.get(`${API_URL}/api/arena/game/:id`, () => HttpResponse.json({ message: 'brak' }, { status: 404 })));
  mount();
  expect(await screen.findByText('Wczytuję walkę…')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Wróć do Areny' })).toHaveAttribute('href', '/arena');
});
