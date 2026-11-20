import { setClerkSession } from '../test/clerk';
import { fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it } from 'vitest';
import API_URL from '../apiConfig';
import { AuthProvider } from '../context/AuthContext';
import { createToken } from '../test/fixtures/auth';
import { server } from '../test/mocks/server';
import type { ArenaMatchSummary } from '../types/api';
import ArenaHistoryPage from './ArenaHistoryPage';

const battle = (id: number, overrides: Partial<ArenaMatchSummary> = {}): ArenaMatchSummary => ({
  id, opponentName: `rywal${id}`, result: 'WIN', eloChange: 12, finishedAt: '2026-11-18T21:14:00', ...overrides,
});

const mount = () => render(<MemoryRouter><AuthProvider><ArenaHistoryPage /></AuthProvider></MemoryRouter>);

beforeEach(() => setClerkSession(createToken()));

it('lists battles with the result, opponent and Elo change and loads more on request', async () => {
  const pages: Record<string, { items: ArenaMatchSummary[]; hasMore: boolean }> = {
    0: { items: [battle(1, { result: 'LOSS', eloChange: -14, opponentName: 'nullbyte' }), battle(2, { result: 'DRAW', eloChange: 0 })], hasMore: true },
    1: { items: [battle(3)], hasMore: false },
  };
  server.use(http.get(`${API_URL}/api/arena/matches`, ({ request }) => HttpResponse.json(pages[new URL(request.url).searchParams.get('page') ?? '0'])));
  mount();
  const first = await screen.findByRole('link', { name: /Przegrana z nullbyte/ });
  expect(first).toHaveAttribute('href', '/arena/history/1');
  expect(first).toHaveTextContent('-14 Elo');
  expect(first.querySelector('.bh-tone-loss')).toHaveTextContent('Przegrana');
  expect(screen.getByRole('link', { name: /Remis z rywal2/ })).toHaveTextContent('0 Elo');
  fireEvent.click(screen.getByRole('button', { name: 'Pokaż więcej' }));
  expect(await screen.findByRole('link', { name: /Wygrana z rywal3/ })).toHaveTextContent('+12 Elo');
  expect(screen.queryByRole('button', { name: 'Pokaż więcej' })).not.toBeInTheDocument();
});

it('invites the player to fight when there is no history yet', async () => {
  mount();
  expect(await screen.findByText('Twoje bitwy pojawią się tutaj po pierwszym pojedynku.')).toBeInTheDocument();
});
