import { setClerkSession } from '../test/clerk';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it } from 'vitest';
import API_URL from '../apiConfig';
import { AuthProvider } from '../context/AuthContext';
import { createToken } from '../test/fixtures/auth';
import { server } from '../test/mocks/server';
import type { ArenaMatchDetail, ArenaMatchRound } from '../types/api';
import ArenaMatchPage from './ArenaMatchPage';

const round = (overrides: Partial<ArenaMatchRound>): ArenaMatchRound => ({
  round: 1, content: 'Pytanie', category: 'SIECI', difficulty: 'EASY', answers: ['A', 'B', 'C', 'D'], correctAnswer: 0,
  choice: 0, answerMillis: 2_800, opponentChoice: 0, opponentAnswerMillis: 4_100, hpAfter: 100, opponentHpAfter: 82, ...overrides,
});

const detail: ArenaMatchDetail = {
  summary: { id: 7, opponentName: 'nullbyte', result: 'LOSS', eloChange: -14, finishedAt: '2026-11-18T21:14:00' },
  finishReason: 'ROUNDS', eloBefore: 1198, opponentElo: 1231, hp: 12, opponentHp: 30, durationSeconds: 220,
  rounds: [
    round({ round: 1, content: 'Host ma adres 169.254.10.20. Co to oznacza?', answers: ['Brak DHCP', 'Publiczny', 'Pętla', 'Rozgłoszenie'] }),
    round({ round: 2, content: 'Cache ignoruje X-Forwarded-Host. Co przeanalizować?', category: 'WEB', difficulty: 'VERY_HARD',
      answers: ['Utrwalenie sesji', 'Traversal', 'Zatrucie cache', 'Wyścig'], correctAnswer: 2, choice: 0, answerMillis: 11_200, opponentChoice: 0, opponentAnswerMillis: 5_000 }),
    round({ round: 3, content: 'Sticky bit na /tmp ogranicza?', correctAnswer: 1, choice: null, answerMillis: null, opponentChoice: 3, opponentAnswerMillis: 6_100 }),
  ],
};

const mount = (path = '/arena/history/7') => render(
  <MemoryRouter initialEntries={[path]}>
    <AuthProvider>
      <Routes>
        <Route path="/arena/history/:matchId" element={<ArenaMatchPage />} />
        <Route path="/arena/history/game/:gameId" element={<ArenaMatchPage />} />
      </Routes>
    </AuthProvider>
  </MemoryRouter>,
);

beforeEach(() => {
  setClerkSession(createToken());
  server.use(http.get(`${API_URL}/api/arena/matches/7`, () => HttpResponse.json(detail)));
});

it('sums up who won, the Elo change, leagues, HP and the next league', async () => {
  mount();
  expect(await screen.findByRole('heading', { level: 1, name: 'Przegrana z nullbyte' })).toBeInTheDocument();
  expect(screen.getByText('-14 Elo')).toBeInTheDocument();
  expect(screen.getByText(/koniec po 3 rundach, rywal ma więcej HP/)).toBeInTheDocument();
  expect(screen.getByText('Liga Root')).toBeInTheDocument();
  expect(screen.getByText('Liga Zero-day')).toBeInTheDocument();
  expect(screen.getByText('12 HP')).toBeInTheDocument();
  expect(screen.getByText('30 HP')).toBeInTheDocument();
  expect(screen.getByText('1 : 1')).toBeInTheDocument();
  expect(screen.getByText('3 min 40 s')).toBeInTheDocument();
  expect(screen.getByText('Do ligi Zero-day brakuje Ci teraz 16 Elo. Przed bitwą brakowało 2 Elo.')).toBeInTheDocument();
});

it('shows every question in full, collapsed and coloured by the player answer', async () => {
  mount();
  const rounds = await screen.findAllByRole('group');
  expect(rounds).toHaveLength(3);
  expect(rounds.every(item => !item.hasAttribute('open'))).toBe(true);
  expect(screen.getByText('Cache ignoruje X-Forwarded-Host. Co przeanalizować?')).toBeInTheDocument();
  expect(rounds[0]).toHaveClass('bh-round-good');
  expect(rounds[1]).toHaveClass('bh-round-wrong');
  expect(rounds[2]).toHaveClass('bh-round-wrong');
  expect(screen.queryByText(/Ty ✓|rywal ✗/)).not.toBeInTheDocument();
});

it('marks both wrong picks and the right answer when both players miss', async () => {
  mount();
  fireEvent.click(await screen.findByText('Cache ignoruje X-Forwarded-Host. Co przeanalizować?'));
  const second = screen.getAllByRole('group')[1];
  expect(second).toHaveAttribute('open');
  const answers = within(second).getAllByRole('listitem');
  expect(answers[0]).toHaveClass('bh-answer-wrong');
  expect(answers[0]).toHaveTextContent('Ty, 11,2 s');
  expect(answers[0]).toHaveTextContent('rywal, 5,0 s');
  expect(answers[2]).toHaveClass('bh-answer-right');
  expect(answers[1]).toHaveClass('bh-answer-plain');
  expect(within(second).getByText('Web · Bardzo trudny')).toBeInTheDocument();
});

it('steps to the next question and opens every question at once', async () => {
  mount();
  fireEvent.click(await screen.findByText('Cache ignoruje X-Forwarded-Host. Co przeanalizować?'));
  fireEvent.click(within(screen.getAllByRole('group')[1]).getByRole('button', { name: /Następne/ }));
  const rounds = screen.getAllByRole('group');
  expect(rounds[1]).not.toHaveAttribute('open');
  expect(rounds[2]).toHaveAttribute('open');
  expect(within(rounds[2]).getByText('Brak Twojej odpowiedzi w 15 sekund.')).toBeInTheDocument();
  expect(within(rounds[2]).getByRole('button', { name: /Następne/ })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Rozwiń wszystkie' }));
  expect(screen.getAllByRole('group').every(item => item.hasAttribute('open'))).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Zwiń wszystkie' }));
  expect(screen.getAllByRole('group').some(item => item.hasAttribute('open'))).toBe(false);
});

it('opens the battle that just ended from its game id', async () => {
  server.use(http.get(`${API_URL}/api/arena/matches/game/g-1`, () => HttpResponse.json(detail)));
  mount('/arena/history/game/g-1');
  expect(await screen.findByRole('heading', { level: 1, name: 'Przegrana z nullbyte' })).toBeInTheDocument();
});

it('explains that older battles have no saved questions', async () => {
  server.use(http.get(`${API_URL}/api/arena/matches/7`, () => HttpResponse.json({
    summary: { ...detail.summary, result: 'WIN', eloChange: 16 }, rounds: [],
  })));
  mount();
  expect(await screen.findByRole('heading', { level: 1, name: 'Wygrana z nullbyte' })).toBeInTheDocument();
  expect(screen.getByText('+16 Elo')).toBeInTheDocument();
  expect(screen.getByText(/Ta bitwa odbyła się wcześniej/)).toBeInTheDocument();
  expect(screen.queryByText(/HP$/)).not.toBeInTheDocument();
});

it('tells the player when the battle is not theirs', async () => {
  server.use(http.get(`${API_URL}/api/arena/matches/7`, () => new HttpResponse(null, { status: 404 })));
  mount();
  expect(await screen.findByRole('heading', { name: 'Nie ma takiej bitwy' })).toBeInTheDocument();
});
