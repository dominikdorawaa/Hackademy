import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, it } from 'vitest';
import API_URL from '../apiConfig';
import { AuthProvider } from '../context/AuthContext';
import { setClerkSession } from '../test/clerk';
import { createToken, createUser } from '../test/fixtures/auth';
import { server } from '../test/mocks/server';
import type { RankingEntry, RankingSummaryDto } from '../types/api';
import RankingPage from './RankingPage';

const url = `${API_URL}/api/ranking/summary`;
const player = (username: string, points: number, elo: number, rankPoints: number | null, rankElo: number | null): RankingEntry => ({ username, points, elo, rankPoints, rankElo });
const mount = () => render(<MemoryRouter><AuthProvider><RankingPage /></AuthProvider></MemoryRouter>);
const respond = (data: Partial<RankingSummaryDto>) => server.use(http.get(url, () => HttpResponse.json({ ranking: [], user: null, myRank: null, ...data })));
const board = (name: 'Ranking nauki' | 'Ranking Areny') => screen.getByRole('region', { name });

beforeEach(() => setClerkSession(createToken()));

it('shows independent rankings, real positions, ties and zero Elo with shared leagues', async () => {
  respond({ ranking: [player('alice', 900, 0, 1, 150), player('bob', 100, 1200, 72, 1), player('carol', 900, 600, 1, 42)] });
  mount();
  await screen.findByRole('region', { name: 'Ranking nauki' });
  const learningRows = within(board('Ranking nauki')).getAllByRole('row');
  const learningPodium = within(within(board('Ranking nauki')).getByRole('list', { name: 'Podium' })).getAllByRole('listitem');
  expect(learningPodium).toHaveLength(2);
  expect(learningPodium[0]).toHaveTextContent('#1alice');
  expect(learningPodium[1]).toHaveTextContent('#1carol');
  expect(learningPodium[0]).toHaveTextContent('Poziom 10');
  expect(learningRows[1]).toHaveTextContent('#72bob');
  const arenaRows = within(board('Ranking Areny')).getAllByRole('row');
  const arenaPodium = within(within(board('Ranking Areny')).getByRole('list', { name: 'Podium' })).getAllByRole('listitem');
  expect(arenaPodium[0]).toHaveTextContent('#1bob');
  expect(arenaPodium[0]).toHaveTextContent('Zero-day');
  expect(arenaRows[1]).toHaveTextContent('#42carol');
  expect(arenaRows[1]).toHaveTextContent('Skaner');
  expect(arenaRows[2]).toHaveTextContent('#150alice');
  expect(within(arenaRows[2]).getByText('0')).toBeInTheDocument();
  expect(arenaRows[2].querySelector('.league-icon')).toHaveAttribute('data-league', 'script-kiddie');
  expect(within(board('Ranking Areny')).getByRole('link', { name: 'Wejdź na arenę' })).toHaveAttribute('href', '/arena');
  expect(within(board('Ranking nauki')).getByRole('link', { name: 'Zdobywaj XP' })).toHaveAttribute('href', '/learn');
});

it('links both portrait and name to the profile and highlights the current user without duplicates', async () => {
  const me = player('tester', 10, 500, 9, 6);
  respond({ ranking: [me], user: createUser(), myRank: me });
  mount();
  await screen.findByRole('region', { name: 'Ranking nauki' });
  for (const name of ['Ranking nauki', 'Ranking Areny'] as const) {
    const section = board(name);
    expect(within(section).getByRole('link', { name: 'Profil gracza tester' })).toHaveAttribute('href', '/profile');
    expect(within(section).getByRole('link', { name: 'tester' })).toHaveAttribute('href', '/profile');
    expect(section.querySelectorAll('.ranking-row.is-me')).toHaveLength(1);
    expect(section.querySelector('.is-me')).toHaveAttribute('aria-current', 'true');
    expect(within(section).queryByText('Twoja pozycja')).not.toBeInTheDocument();
  }
});

it('keeps an out-of-top-ten user at their actual rank and selects each board top ten separately', async () => {
  const players = Array.from({ length: 12 }, (_, i) => player(`gracz${i}`, 1200 - i * 100, i * 100, i + 1, 12 - i));
  respond({ ranking: players, user: createUser(), myRank: player('tester', 0, 0, 135, 177) });
  mount();
  await screen.findByRole('region', { name: 'Ranking nauki' });
  const learning = board('Ranking nauki');
  const arena = board('Ranking Areny');
  expect(learning.querySelectorAll('.ranking-row')).toHaveLength(8);
  expect(arena.querySelectorAll('.ranking-row')).toHaveLength(8);
  expect(within(learning).getAllByRole('listitem')).toHaveLength(3);
  expect(within(arena).getAllByRole('listitem')).toHaveLength(3);
  expect(within(learning).queryByRole('link', { name: 'gracz11' })).not.toBeInTheDocument();
  expect(within(arena).getByRole('link', { name: 'gracz11' })).toBeInTheDocument();
  expect(within(learning).getByText('#135')).toBeInTheDocument();
  expect(within(arena).getByText('#177')).toBeInTheDocument();
  expect(within(learning).getByText('Twoja pozycja')).toBeInTheDocument();
});

it('uses profile URLs safely and never invents a missing place', async () => {
  respond({ ranking: [player('ola test', 0, 500, null, null)] });
  mount();
  await screen.findByRole('region', { name: 'Ranking nauki' });
  expect(within(board('Ranking nauki')).getByRole('link', { name: 'ola test' })).toHaveAttribute('href', '/profile/ola%20test');
  expect(within(board('Ranking nauki')).getByText('–')).toBeInTheDocument();
});

it('shows empty boards and a login link to visitors', async () => {
  setClerkSession(null);
  respond({});
  mount();
  expect(screen.getByRole('status', { name: 'Ładowanie rankingów' })).toBeInTheDocument();
  await screen.findByRole('region', { name: 'Ranking nauki' });
  expect(screen.getAllByText('Pierwsze miejsce czeka')).toHaveLength(2);
  expect(screen.getByRole('link', { name: 'Zaloguj się' })).toHaveAttribute('href', '/login');
  expect(screen.queryByRole('status', { name: 'Ładowanie rankingów' })).not.toBeInTheDocument();
});

it('handles malformed ranking arrays and a personal rank without a user object', async () => {
  server.use(http.get(url, () => HttpResponse.json({ ranking: null, user: null, myRank: player('tester', 0, 0, 1, 4) })));
  mount();
  await screen.findByRole('region', { name: 'Ranking nauki' });
  expect(within(board('Ranking nauki')).getByRole('link', { name: 'tester' })).toHaveAttribute('href', '/profile');
  expect(screen.queryByRole('link', { name: 'Zaloguj się' })).not.toBeInTheDocument();
  expect(within(board('Ranking Areny')).getByText('#4')).toBeInTheDocument();
});

it('retries a failed response and replaces the error with results', async () => {
  let calls = 0;
  server.use(http.get(url, () => ++calls === 1 ? new HttpResponse(null, { status: 503 }) : HttpResponse.json({ ranking: [], user: null, myRank: null })));
  mount();
  expect(await screen.findByRole('alert')).toHaveTextContent('Ranking chwilowo niedostępny');
  fireEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
  expect(await screen.findByRole('region', { name: 'Ranking nauki' })).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('handles a network failure without showing invented results', async () => {
  server.use(http.get(url, () => HttpResponse.error()));
  mount();
  expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się pobrać wyników');
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

it('shows the nearest known higher score as a concrete goal, including the point needed to overtake', async () => {
  const me = player('tester', 900, 550, 10, 15);
  respond({ ranking: [player('leader', 1500, 1200, 1, 1), player('rival', 1000, 600, 8, 12), me], user: createUser(), myRank: me });
  mount();
  await screen.findByRole('region', { name: 'Ranking nauki' });
  const learning = board('Ranking nauki');
  expect(within(learning).getByText('Twój następny cel: #8')).toBeInTheDocument();
  expect(within(learning).getByText('101 XP')).toBeInTheDocument();
  expect(within(learning).getByRole('progressbar')).toHaveAttribute('value', '900');
  expect(within(learning).getByRole('progressbar')).toHaveAttribute('max', '1001');
  expect(within(learning).getByRole('link', { name: 'Zdobądź XP' })).toHaveAttribute('href', '/learn');
  const arena = board('Ranking Areny');
  expect(within(arena).getByText('51 Elo')).toBeInTheDocument();
  expect(within(arena).getByRole('link', { name: 'Podejmij pojedynek' })).toHaveAttribute('href', '/arena');
});

it('celebrates a shared first place and keeps the personal profile links on the podium without duplicating rows', async () => {
  const me = player('tester', 1000, 1000, 1, 1);
  respond({ ranking: [me, player('alice', 1000, 1000, 1, 1), player('third', 800, 800, 3, 3)], user: createUser(), myRank: me });
  mount();
  await screen.findByRole('region', { name: 'Ranking nauki' });
  for (const name of ['Ranking nauki', 'Ranking Areny'] as const) {
    const section = board(name);
    expect(within(section).getByText('Jesteś na szczycie!')).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: 'tester' })).toHaveAttribute('href', '/profile');
    expect(within(section).getByRole('link', { name: 'Profil gracza tester' })).toHaveAttribute('href', '/profile');
    expect(section.querySelector('.ranking-podium-player.is-me')).toHaveAttribute('aria-current', 'true');
    expect(within(section).getAllByRole('listitem')).toHaveLength(3);
    expect(within(section).queryByRole('table')).not.toBeInTheDocument();
    expect(within(section).queryByRole('progressbar')).not.toBeInTheDocument();
    expect(within(section).queryByText('Pierwsze miejsce czeka')).not.toBeInTheDocument();
  }
});

it('does not invent a podium or an unknown place when a personal goal has no global rank', async () => {
  respond({ ranking: [player('rival', 0, -10, null, null)], myRank: player('tester', -5, -20, 20, 20) });
  mount();
  await screen.findByRole('region', { name: 'Ranking nauki' });
  expect(within(board('Ranking nauki')).getByText('Twój następny cel')).toBeInTheDocument();
  expect(within(board('Ranking nauki')).getByText('6 XP')).toBeInTheDocument();
  expect(within(board('Ranking nauki')).getByRole('progressbar')).toHaveAttribute('value', '0');
  expect(within(board('Ranking Areny')).getByText('11 Elo')).toBeInTheDocument();
  expect(within(board('Ranking Areny')).queryByRole('progressbar')).not.toBeInTheDocument();
  expect(screen.queryByRole('list', { name: 'Podium' })).not.toBeInTheDocument();
});
