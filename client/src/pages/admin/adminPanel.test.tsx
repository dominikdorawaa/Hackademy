import { Route } from 'react-router-dom';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeAll, describe, expect, it } from 'vitest';
import API_URL from '../../apiConfig';
import { server } from '../../test/mocks/server';
import { currentUserHandler } from '../../test/mocks/handlers';
import { createToken } from '../../test/fixtures/auth';
import { renderWithAuth } from '../../test/renderWithAuth';
import type {
  AdminStatsDto,
  Role,
  RoomAdminSummaryDto,
} from '../../types/api';
import adminRoutes from './adminRoutes';

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

const room = (id: number, title: string, overrides: Partial<RoomAdminSummaryDto> = {}): RoomAdminSummaryDto => ({
  id,
  title,
  category: 'Path',
  difficulty: 'EASY',
  points: 20,
  requiresVpn: false,
  roomType: 'PATH',
  pathId: null,
  pathTitle: null,
  ...overrides,
});

const stats: AdminStatsDto = {
  totals: { users: 12345, solves: 58, activeThisWeek: 6, pendingReports: 2 },
  rangeDays: 30,
  timeline: [
    { date: '2026-10-09', registrations: 1, solves: 3 },
    { date: '2026-10-10', registrations: 2, solves: 4 },
  ],
  solvesBySource: [
    { key: 'path-1', label: 'Web', count: 6 },
    { key: 'ctf', label: 'CTF', count: 2 },
  ],
  recentSolves: [
    { username: 'ania', roomId: 3, roomTitle: 'SQL Injection 101', roomType: 'CTF', pathTitle: null, solvedAt: '2026-10-10T10:00:00' },
  ],
};

function signIn(role: Role) {
  localStorage.setItem('token', createToken(role));
  server.use(currentUserHandler(role));
}

function mountAdmin(path: string) {
  return renderWithAuth(
    <>
      {adminRoutes}
      <Route path="/" element={<div>strona główna</div>} />
      <Route path="/login" element={<div>logowanie</div>} />
    </>,
    path,
  );
}

function navigation() {
  return within(screen.getByLabelText('Nawigacja panelu'));
}

describe('admin panel layout', () => {
  it('shows every section to an administrator and keeps the section after a reload', async () => {
    signIn('ADMIN');
    server.use(http.get(`${API_URL}/api/admin/users`, () => HttpResponse.json([])));
    mountAdmin('/admin/users');

    expect(await screen.findByRole('heading', { name: 'Użytkownicy', level: 1 })).toBeInTheDocument();
    for (const name of ['Pulpit', 'Ścieżki', 'Pokoje ścieżek', 'Pokoje CTF', 'Użytkownicy', 'Zgłoszenia']) {
      expect(navigation().getByRole('link', { name })).toBeInTheDocument();
    }
    expect(navigation().getByRole('link', { name: 'Wróć do aplikacji' })).toHaveAttribute('href', '/dashboard');
    expect(navigation().getByRole('link', { name: 'Hackademy, panel administratora' })).toHaveAttribute('href', '/admin');
    expect(screen.getByTestId('location').textContent).toBe('/admin/users:POP');
    expect(screen.queryByRole('navigation', { name: /menu/i })).toBeNull();
  });

  it('shows experts only content sections and sends them away from admin-only pages', async () => {
    signIn('EXPERT');
    server.use(http.get(`${API_URL}/api/admin/paths`, () => HttpResponse.json([])));
    mountAdmin('/admin/users');

    expect(await screen.findByRole('heading', { name: 'Ścieżki', level: 1 })).toBeInTheDocument();
    expect(screen.getByTestId('location').textContent).toBe('/admin/paths:REPLACE');
    expect(navigation().getByRole('link', { name: 'Pokoje CTF' })).toBeInTheDocument();
    for (const name of ['Pulpit', 'Użytkownicy', 'Zgłoszenia']) {
      expect(navigation().queryByRole('link', { name })).toBeNull();
    }
    expect(navigation().getByRole('link', { name: 'Hackademy, panel eksperta' })).toHaveAttribute('href', '/admin/paths');
  });

  it('redirects an expert opening the dashboard to paths', async () => {
    signIn('EXPERT');
    server.use(http.get(`${API_URL}/api/admin/paths`, () => HttpResponse.json([])));
    mountAdmin('/admin');
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/admin/paths:REPLACE'));
  });

  it('sends a regular user to the home page', async () => {
    signIn('USER');
    mountAdmin('/admin');
    expect(await screen.findByText('strona główna')).toBeInTheDocument();
    expect(screen.getByTestId('location').textContent).toBe('/:REPLACE');
  });

  it('hides room deletion from experts', async () => {
    const rooms = [room(1, 'Web 1', { roomType: 'CTF', category: 'Web', points: 50 })];
    server.use(http.get(`${API_URL}/api/admin/rooms`, () => HttpResponse.json(rooms)));

    signIn('EXPERT');
    const expertView = mountAdmin('/admin/ctf');
    expect(await screen.findByRole('link', { name: 'Web 1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Usuń Web 1' })).toBeNull();
    expertView.unmount();

    signIn('ADMIN');
    mountAdmin('/admin/ctf');
    expect(await screen.findByRole('button', { name: 'Usuń Web 1' })).toBeInTheDocument();
  });
});

describe('room editor', () => {
  it('keeps the creation message after moving to the new room', async () => {
    signIn('ADMIN');
    const created = {
      id: 9, title: 'Nowy CTF', description: 'Opis', shortDescription: '', difficulty: 'MEDIUM', category: 'Web',
      points: 100, flag: 'CTF{x}', solutionsCount: 0, requiresVpn: false, roomType: 'CTF', hints: [],
      createdAt: '2026-10-10T10:00:00', updatedAt: null,
    };
    server.use(
      http.post(`${API_URL}/api/admin/rooms`, () => HttpResponse.json(created, { status: 201 })),
      http.get(`${API_URL}/api/admin/rooms/9`, () => HttpResponse.json(created)),
    );
    const user = userEvent.setup();
    mountAdmin('/admin/ctf/new');

    await user.type(await screen.findByLabelText('Tytuł'), 'Nowy CTF');
    await user.type(screen.getByLabelText('Opis'), 'Opis');
    await user.type(screen.getByLabelText('Flaga'), 'CTF{x}');
    await user.click(screen.getByRole('button', { name: 'Utwórz pokój' }));

    expect(await screen.findByText('Pokój „Nowy CTF” został utworzony.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/admin/ctf/9:REPLACE'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Nowy CTF' })).toBeInTheDocument();
  });
});

describe('admin dashboard', () => {
  it('shows platform totals and reloads the chart for another range', async () => {
    signIn('ADMIN');
    const ranges: string[] = [];
    server.use(http.get(`${API_URL}/api/admin/stats`, ({ request }) => {
      const range = new URL(request.url).searchParams.get('range') ?? '';
      ranges.push(range);
      return HttpResponse.json({ ...stats, rangeDays: Number(range) });
    }));
    mountAdmin('/admin');

    expect(await screen.findByText('Aktywni w tym tygodniu')).toBeInTheDocument();
    expect(screen.getByText(/12\s345/)).toBeInTheDocument();
    expect(screen.getByText('+3 w ostatnich 30 dni')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Zgłoszenia czatu/ })).toHaveAttribute('href', '/admin/reports');
    const sources = within(screen.getByRole('list', { name: 'Rozwiązania według źródła' }));
    expect(sources.getByText('Web')).toBeInTheDocument();
    expect(sources.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('SQL Injection 101')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'Ostatnie 7 dni' }));
    await waitFor(() => expect(ranges).toEqual(['30', '7']));
    expect(await screen.findByText('Dziennie, ostatnie 7 dni')).toBeInTheDocument();
  });

  it('shows the server error when statistics cannot be loaded', async () => {
    signIn('ADMIN');
    server.use(http.get(`${API_URL}/api/admin/stats`, () => HttpResponse.json({ message: 'Brak dostępu' }, { status: 403 })));
    mountAdmin('/admin');
    expect(await screen.findByText('Brak dostępu')).toBeInTheDocument();
  });
});
