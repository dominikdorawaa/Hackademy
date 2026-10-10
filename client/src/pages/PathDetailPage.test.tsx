import { Route } from 'react-router-dom';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import API_URL from '../apiConfig';
import { server } from '../test/mocks/server';
import { createToken } from '../test/fixtures/auth';
import { renderWithAuth } from '../test/renderWithAuth';
import type { PathDetailDto, RoomSummaryDto } from '../types/api';
import PathDetailPage from './PathDetailPage';

const summary = {
  shortDescription: '',
  difficulty: 'EASY',
  category: 'Path',
  points: 20,
  solutionsCount: 0,
  requiresVpn: false,
  roomType: 'PATH',
  createdAt: '2026-10-01T00:00:00',
} as const;

const room = (id: number, title: string, solved: boolean, locked: boolean): RoomSummaryDto => ({ ...summary, id, title, solved, locked });

const path = (enrolled: boolean): PathDetailDto => ({
  id: 5,
  title: 'Bezpieczeństwo aplikacji',
  description: 'Od HTTP do podatności',
  bannerUrl: null,
  hasBanner: false,
  enrolled,
  rooms: [],
  chapters: [
    { id: 1, title: 'Podstawy', totalRooms: 2, solvedRooms: 1, rooms: [room(1, 'HTTP', true, false), room(2, 'Cookies', false, false)] },
    { id: 2, title: 'Ataki', totalRooms: 1, solvedRooms: 0, rooms: [room(3, 'SQL', false, true)] },
    { id: 3, title: 'Wkrótce', totalRooms: 0, solvedRooms: 0, rooms: [] },
  ],
});

function mount() {
  localStorage.setItem('token', createToken('USER'));
  return renderWithAuth(<Route path="/learn/paths/:id" element={<PathDetailPage />} />, '/learn/paths/5');
}

describe('path page', () => {
  it('groups rooms into chapters with progress for each chapter', async () => {
    server.use(http.get(`${API_URL}/api/paths/5`, () => HttpResponse.json(path(true))));
    mount();

    const first = await screen.findByRole('region', { name: 'Podstawy' });
    expect(within(first).getByText('1/2 ukończone')).toBeInTheDocument();
    expect(within(first).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
    expect(within(first).getByText('Ukończone')).toBeInTheDocument();
    const second = screen.getByRole('region', { name: 'Ataki' });
    expect(within(second).getByText('SQL')).toBeInTheDocument();
    expect(within(second).getByText('Zablokowane')).toBeInTheDocument();
    expect(within(second).getByRole('button', { name: /Start/ })).toBeDisabled();
    expect(within(screen.getByRole('region', { name: 'Wkrótce' })).getByText('Ten rozdział nie ma jeszcze pokoi.')).toBeInTheDocument();
    expect(screen.getByText('Rozdział 2')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Zacznij tę ścieżkę/ })).toBeNull();
  });

  it('shows the path title before enrolling and reloads after enrolling', async () => {
    let enrolled = false;
    server.use(
      http.get(`${API_URL}/api/paths/5`, () => HttpResponse.json(path(enrolled))),
      http.post(`${API_URL}/api/paths/5/enroll`, () => {
        enrolled = true;
        return new HttpResponse(null, { status: 200 });
      }),
    );
    mount();

    expect(await screen.findByRole('heading', { level: 1, name: 'Bezpieczeństwo aplikacji' })).toBeInTheDocument();
    expect(screen.getByText('3 rozdz.', { exact: false })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Zacznij tę ścieżkę/ }));
    expect(await screen.findByText('Przechodź rozdziały krok po kroku.')).toBeInTheDocument();
  });

  it('shows an error when the path cannot be loaded', async () => {
    server.use(http.get(`${API_URL}/api/paths/5`, () => new HttpResponse(null, { status: 500 })));
    mount();
    expect(await screen.findByText('Błąd: Nie udało się pobrać ścieżki.')).toBeInTheDocument();
  });
});
