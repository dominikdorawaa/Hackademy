import { setClerkSession } from '../test/clerk';
import { Route, useLocation } from 'react-router-dom';
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
  description: '',
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
    { id: 1, title: 'Podstawy', totalRooms: 2, solvedRooms: 1, rooms: [room(1, 'HTTP', true, false), { ...room(2, 'Cookies', false, false), description: 'Ciasteczka i sesje w przeglądarce' }] },
    { id: 2, title: 'Ataki', totalRooms: 1, solvedRooms: 0, rooms: [room(3, 'SQL', false, true)] },
    { id: 3, title: 'Wkrótce', totalRooms: 0, solvedRooms: 0, rooms: [] },
  ],
});

function mount() {
  setClerkSession(createToken('USER'));
  return renderWithAuth(<Route path="/learn/paths/:id" element={<PathDetailPage />} />, '/learn/paths/5');
}

function OpenedRoom() {
  const location = useLocation();
  return <p>{location.pathname + location.search}</p>;
}

describe('path page', () => {
  it('opens a room with this path as its return context', async () => {
    server.use(http.get(`${API_URL}/api/paths/5`, () => HttpResponse.json(path(true))));
    setClerkSession(createToken('USER'));
    renderWithAuth(<>
      <Route path="/learn/paths/:id" element={<PathDetailPage />} />
      <Route path="/rooms/:id" element={<OpenedRoom />} />
    </>, '/learn/paths/5');
    const first = await screen.findByRole('region', { name: 'Podstawy' });
    await userEvent.click(within(first).getAllByRole('button', { name: /Start/ })[0]);
    expect(await screen.findByText('/rooms/2?pathId=5')).toBeInTheDocument();
  });

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
    expect(screen.getByText('3 rozdziały')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Zacznij tę ścieżkę/ }));
    expect(await screen.findByText('Przechodź rozdziały krok po kroku.')).toBeInTheDocument();
  });

  it('marks chapters after the first as Premium for players without a subscription', async () => {
    const free = path(true);
    server.use(http.get(`${API_URL}/api/paths/5`, () => HttpResponse.json({
      ...free,
      chapters: free.chapters.map(chapter => chapter.id === 1 ? chapter : {
        ...chapter, locked: true, premium: true, rooms: chapter.rooms.map(item => ({ ...item, locked: true, premium: true })),
      }),
    })));
    mount();

    const first = await screen.findByRole('region', { name: 'Podstawy' });
    expect(within(first).queryByRole('link', { name: 'Premium' })).toBeNull();
    const second = screen.getByRole('region', { name: 'Ataki' });
    expect(within(second).getByRole('link', { name: 'Premium' })).toHaveAttribute('href', '/premium');
    expect(within(second).queryByText('Zablokowany')).toBeNull();
    expect(within(second).getByText('Premium', { selector: '.pd-status' })).toBeInTheDocument();
    expect(within(second).getByRole('button', { name: /Start/ })).toBeDisabled();
    expect(screen.getByText('Dalsze rozdziały w Premium')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zobacz Premium' })).toHaveAttribute('href', '/premium');
  });

  it('shows chapter locks and the unlock mode hint', async () => {
    const locked = path(true);
    server.use(http.get(`${API_URL}/api/paths/5`, () => HttpResponse.json({
      ...locked,
      unlockMode: 'CHAPTER',
      chapters: locked.chapters.map((chapter) => ({ ...chapter, locked: chapter.id !== 1 })),
    })));
    mount();

    const first = await screen.findByRole('region', { name: 'Podstawy' });
    expect(within(first).queryByText('Zablokowany')).toBeNull();
    expect(within(screen.getByRole('region', { name: 'Ataki' })).getByText('Zablokowany')).toBeInTheDocument();
    expect(screen.getByText('Kolejny rozdział otwiera się po ukończeniu wszystkich pokoi poprzedniego.')).toBeInTheDocument();
  });

  it('numbers rooms within their chapter and keeps the icons of solved, locked and next rooms', async () => {
    server.use(http.get(`${API_URL}/api/paths/5`, () => HttpResponse.json({
      ...path(true),
      chapters: [
        { id: 1, title: 'Podstawy', totalRooms: 3, solvedRooms: 1, rooms: [room(1, 'HTTP', true, false), room(2, 'Cookies', false, false), room(3, 'Sesje', false, false)] },
        { id: 2, title: 'Ataki', totalRooms: 2, solvedRooms: 0, rooms: [room(4, 'XSS', false, false), room(5, 'SQL', false, true)] },
        { id: 3, title: 'Obrona', totalRooms: 2, solvedRooms: 0, rooms: [room(6, 'CSP', false, false), room(7, 'WAF', false, false)] },
      ],
    })));
    mount();

    const markers = (name: string) => Array.from(screen.getByRole('region', { name }).querySelectorAll('.pd-node'));
    const icon = (marker: Element) => marker.querySelector('svg')?.getAttribute('class');
    await screen.findByRole('region', { name: 'Podstawy' });

    const [solved, next, third] = markers('Podstawy');
    expect(icon(solved)).toContain('lucide-check');
    expect(icon(next)).toContain('lucide-play');
    expect(third).toHaveTextContent(/^1\.3$/);
    const [firstAttack, lockedAttack] = markers('Ataki');
    expect(firstAttack).toHaveTextContent(/^2\.1$/);
    expect(icon(lockedAttack)).toContain('lucide-lock');
    expect(lockedAttack).toHaveTextContent(/^$/);
    expect(markers('Obrona').map(marker => marker.textContent)).toEqual(['3.1', '3.2']);
    expect(screen.getAllByText(/^0[1-3]$/).map(chapter => chapter.textContent)).toEqual(['01', '02', '03']);
  });

  it('shows the room description on its card and nothing for a room without one', async () => {
    server.use(http.get(`${API_URL}/api/paths/5`, () => HttpResponse.json(path(true))));
    mount();
    const first = await screen.findByRole('region', { name: 'Podstawy' });
    const card = within(first).getByText('Ciasteczka i sesje w przeglądarce');
    expect(card).toHaveClass('pd-room-desc');
    expect(first.querySelectorAll('.pd-room-desc')).toHaveLength(1);
  });

  it('shows an error when the path cannot be loaded', async () => {
    server.use(http.get(`${API_URL}/api/paths/5`, () => new HttpResponse(null, { status: 500 })));
    mount();
    expect(await screen.findByText('Błąd: Nie udało się pobrać ścieżki.')).toBeInTheDocument();
  });
});
