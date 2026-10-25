import { setClerkSession } from '../../test/clerk';
import { Route } from 'react-router-dom';
import { configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import API_URL from '../../apiConfig';
import { server } from '../../test/mocks/server';
import { currentUserHandler } from '../../test/mocks/handlers';
import { createToken } from '../../test/fixtures/auth';
import { renderWithAuth } from '../../test/renderWithAuth';
import type {
  AdminStatsDto,
  BugReportAdmin,
  BugReportStatus,
  Role,
  RoomAdminSummaryDto,
} from '../../types/api';
import adminRoutes from './adminRoutes';
import * as contentApi from '../../services/contentApi';

afterEach(() => vi.restoreAllMocks());

afterAll(() => configure({ asyncUtilTimeout: 1000 }));

beforeAll(() => {
  configure({ asyncUtilTimeout: 3000 });
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = () => {};
  HTMLElement.prototype.releasePointerCapture = () => {};
  HTMLElement.prototype.scrollIntoView = () => {};
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

const bugReport = (overrides: Partial<BugReportAdmin> = {}): BugReportAdmin => ({
  id: 1,
  reporterUsername: 'gracz1',
  source: 'ROOM',
  roomId: 4,
  roomTitle: 'SQL Injection 101',
  taskId: 9,
  taskTitle: 'Logowanie',
  gameId: null,
  lessonId: null,
  pagePath: '/rooms/4',
  description: 'Flaga nie przechodzi',
  status: 'OPEN',
  createdAt: '2026-10-24T12:00:00',
  resolvedAt: null,
  ...overrides,
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
  totals: { users: 12345, solves: 58, activeThisWeek: 6, openBugReports: 2 },
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
  setClerkSession(createToken(role));
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
  it('uses the shared theme selector in the administrative header', async () => {
    signIn('ADMIN');
    server.use(http.get(`${API_URL}/api/admin/users`, () => HttpResponse.json([])));
    mountAdmin('/admin/users');
    await screen.findByRole('heading', { name: 'Użytkownicy', level: 1 });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Włącz jasny motyw' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(localStorage.getItem('app-theme')).toBe('light');
  });
  it('shows every section to an administrator and keeps the section after a reload', async () => {
    signIn('ADMIN');
    server.use(http.get(`${API_URL}/api/admin/users`, () => HttpResponse.json([])));
    mountAdmin('/admin/users');

    expect(await screen.findByRole('heading', { name: 'Użytkownicy', level: 1 })).toBeInTheDocument();
    for (const name of ['Pulpit', 'Ścieżki', 'Pokoje ścieżek', 'Pokoje CTF', 'Pytania areny', 'Użytkownicy', 'Zgłoszenia błędów']) {
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
    for (const name of ['Pulpit', 'Pytania areny', 'Użytkownicy', 'Zgłoszenia błędów']) {
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

describe('content editors', () => {
  it('retains every local field and revision on a concurrent path save conflict', async () => {
    signIn('ADMIN');
    const initial = { id: 5, title: 'Web', description: 'Opis', bannerUrl: null, hasBanner: false, revision: 2, contentRevision: 3, published: false,
      chapters: [{ id: 11, title: 'Rozdział 1', roomIds: [] }] };
    server.use(http.get(`${API_URL}/api/admin/rooms`, () => HttpResponse.json([])), http.get(`${API_URL}/api/admin/paths/5`, () => HttpResponse.json(initial)));
    const save = vi.spyOn(contentApi, 'savePath').mockRejectedValue(new contentApi.ContentError('Materiał zmienił się w międzyczasie.'));
    const user = userEvent.setup(); mountAdmin('/admin/paths/5');
    await user.type(await screen.findByLabelText('Nazwa rozdziału 1 *'), ' lokalny');
    await user.type(screen.getByLabelText('Tytuł *'), ' zmieniony');
    await user.click(screen.getByRole('button', { name: 'Zapisz szkic' }));
    expect(await screen.findByText('Materiał zmienił się w międzyczasie.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nazwa rozdziału 1 *')).toHaveValue('Rozdział 1 lokalny');
    expect(save.mock.calls[0][1]).toMatchObject({ revision: 3, chaptersRevision: 2, title: 'Web zmieniony', chapters: [{ title: 'Rozdział 1 lokalny' }] });
  });
  it('blocks an existing room after load failure and preserves hints after retry', async () => {
    signIn('ADMIN'); let loads = 0;
    const existing = { id: 9, title: 'CTF', description: 'Opis', shortDescription: '', difficulty: 'MEDIUM', category: 'Web', points: 100,
      flag: 'CTF{x}', solutionsCount: 0, requiresVpn: false, roomType: 'CTF', hints: ['Zachowana podpowiedź'], published: true, contentRevision: 2, createdAt: '2026-10-10T10:00:00', updatedAt: null };
    const detail = { room: existing, tasks: { revision: 0, tasks: [] } };
    server.use(http.get(`${API_URL}/api/admin/content/rooms/9`, () => ++loads === 1 ? HttpResponse.json({ message: 'Nie udało się wczytać pokoju' }, { status: 500 }) : HttpResponse.json(detail)));
    const save = vi.spyOn(contentApi, 'saveRoom').mockResolvedValue(detail as contentApi.RoomEditor);
    const user = userEvent.setup(); mountAdmin('/admin/ctf/9');
    expect(await screen.findByText('Nie udało się wczytać pokoju')).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Edytor pokoju' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    expect(await screen.findByLabelText('Podpowiedź 1 *')).toHaveValue('Zachowana podpowiedź');
    await user.type(screen.getByLabelText('Tytuł *'), ' zmieniony');
    await user.click(screen.getByRole('button', { name: 'Zapisz zmiany' }));
    expect(await screen.findByText('Zapisano opublikowany pokój.')).toBeInTheDocument();
    expect(save.mock.calls[0][1].hints).toEqual(['Zachowana podpowiedź']);
  });
  it('saves an incomplete CTF as a draft and keeps the new room available for preview', async () => {
    signIn('ADMIN');
    const created = { id: 9, title: 'Nowy CTF', description: '', shortDescription: '', difficulty: 'EASY', category: 'Web', points: 0,
      flag: '', solutionsCount: 0, requiresVpn: false, roomType: 'CTF', hints: [], published: false, contentRevision: 1, createdAt: '2026-10-10T10:00:00', updatedAt: null };
    server.use(http.get(`${API_URL}/api/admin/content/rooms/9`, () => HttpResponse.json({ room: created, tasks: { revision: 0, tasks: [] } })));
    const save = vi.spyOn(contentApi, 'saveRoom').mockResolvedValue({ room: created, tasks: { revision: 0, tasks: [] } } as contentApi.RoomEditor);
    const user = userEvent.setup(); mountAdmin('/admin/ctf/new');
    await user.type(await screen.findByLabelText('Tytuł *'), 'Nowy CTF');
    await user.click(screen.getByRole('button', { name: 'Zapisz szkic' }));
    expect(await screen.findByText('Zapisano szkic pokoju.')).toBeInTheDocument();
    expect(save.mock.calls[0][1]).toMatchObject({ published: false, description: '', flag: '' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Nowy CTF' })).toBeInTheDocument();
  });
});

describe('admin dashboard', () => {
  it('keeps the displayed period attached to the last successfully loaded data', async () => {
    signIn('ADMIN');
    server.use(http.get(`${API_URL}/api/admin/stats`, ({ request }) => {
      const range = new URL(request.url).searchParams.get('range');
      return range === '7'
        ? HttpResponse.json({ message: 'Nie udało się zmienić zakresu' }, { status: 500 })
        : HttpResponse.json(stats);
    }));
    mountAdmin('/admin');
    await screen.findByText('+3 w ostatnich 30 dni');
    await userEvent.click(screen.getByRole('radio', { name: 'Ostatnie 7 dni' }));
    expect(await screen.findByText('Nie udało się zmienić zakresu')).toBeInTheDocument();
    expect(screen.getByText('+3 w ostatnich 30 dni')).toBeInTheDocument();
    expect(screen.getByText('Dziennie, ostatnie 30 dni')).toBeInTheDocument();
    expect(screen.getByText('Rejestracje i rozwiązania dziennie, ostatnie 30 dni')).toBeInTheDocument();
    expect(screen.queryByText('+3 w ostatnich 7 dni')).not.toBeInTheDocument();
  });

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
    expect(screen.getByRole('link', { name: /Czekają na sprawdzenie/ })).toHaveAttribute('href', '/admin/bug-reports');
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

  it('pages users on the server and resets to the first page after searching', async () => {
    signIn('ADMIN');
    const requests: { page: string; query: string }[] = [];
    server.use(http.get(`${API_URL}/api/admin/users`, ({ request }) => {
      const url = new URL(request.url);
      const page = url.searchParams.get('page') ?? '0';
      const query = url.searchParams.get('query') ?? '';
      requests.push({ page, query });
      return HttpResponse.json({ items: [{ id: Number(page) + 1, username: query || `page${page}`, email: 'fixture@example.com', role: 'USER', createdAt: '2026-10-01T00:00:00' }], page: Number(page), size: 50, hasNext: page === '0' && !query });
    }));
    mountAdmin('/admin/users');
    const user = userEvent.setup();
    await screen.findByText('page0');
    expect(screen.getByRole('button', { name: 'Poprzednia' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Następna' }));
    await screen.findByText('page1');
    expect(screen.getByRole('button', { name: 'Następna' })).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Szukaj użytkownika' }), 'selected');
    await screen.findByText('selected');
    expect(requests.at(-1)).toEqual({ page: '0', query: 'selected' });
  });

  it('pages bug reports by status without fetching the entire list', async () => {
    signIn('ADMIN');
    const requests: { page: string; status: string }[] = [];
    server.use(http.get(`${API_URL}/api/admin/bug-reports`, ({ request }) => {
      const url = new URL(request.url);
      const page = Number(url.searchParams.get('page'));
      const status = url.searchParams.get('status') ?? '';
      requests.push({ page: String(page), status });
      if (status === 'RESOLVED') return HttpResponse.json({ items: [], page, size: 50, hasNext: false });
      return HttpResponse.json({ items: [bugReport({ id: page + 1, description: `report-${status || 'all'}-${page}` })], page, size: 50, hasNext: page === 0 });
    }));
    mountAdmin('/admin/bug-reports');
    const user = userEvent.setup();
    await screen.findByText('report-OPEN-0');
    await user.click(screen.getByRole('button', { name: 'Następna' }));
    await screen.findByText('report-OPEN-1');
    expect(screen.getByRole('button', { name: 'Następna' })).toBeDisabled();
    await user.click(screen.getByRole('combobox', { name: 'Filtruj według statusu' }));
    await user.click(screen.getByRole('option', { name: 'Wszystkie' }));
    await screen.findByText('report-all-0');
    await user.click(screen.getByRole('combobox', { name: 'Filtruj według statusu' }));
    await user.click(screen.getByRole('option', { name: 'Rozwiązane' }));
    expect(await screen.findByText('Nie ma jeszcze rozwiązanych zgłoszeń.')).toBeInTheDocument();
    expect(requests).toEqual([{ page: '0', status: 'OPEN' }, { page: '1', status: 'OPEN' }, { page: '0', status: '' }, { page: '0', status: 'RESOLVED' }]);
  });

  it('explains when the bug reports cannot be loaded', async () => {
    signIn('ADMIN');
    server.use(http.get(`${API_URL}/api/admin/bug-reports`, () => HttpResponse.json({ message: 'Baza niedostępna' }, { status: 503 })));
    mountAdmin('/admin/bug-reports');
    expect(await screen.findByText('Baza niedostępna')).toBeInTheDocument();
  });

  it('shows where each bug report came from', async () => {
    signIn('ADMIN');
    server.use(http.get(`${API_URL}/api/admin/bug-reports`, () => HttpResponse.json({ items: [
      bugReport({ id: 1, description: 'room-report', pagePath: '/rooms/4' }),
      bugReport({ id: 2, description: 'arena-report', source: 'ARENA', roomId: null, roomTitle: null, taskId: null, taskTitle: null, gameId: '7f0c2d1e-aaaa', pagePath: null }),
      bugReport({ id: 3, description: 'gone-room', roomId: null, roomTitle: null, taskId: null, taskTitle: null, pagePath: null }),
      bugReport({ id: 4, description: 'foreign-path', source: 'ARENA', roomId: null, roomTitle: null, taskId: null, taskTitle: null, pagePath: '//evil.example/login' }),
      bugReport({ id: 5, description: 'lab-report', source: 'LAB', roomId: null, roomTitle: null, taskId: null, taskTitle: null, lessonId: 'history', pagePath: '/learn/ukos' }),
      bugReport({ id: 6, description: 'old-lab-step', source: 'LAB', roomId: null, roomTitle: null, taskId: null, taskTitle: null, lessonId: 'removed-step', pagePath: '//evil.example/learn/ukos' }),
    ], page: 0, size: 50, hasNext: false })));
    mountAdmin('/admin/bug-reports');
    const row = async (text: string) => within((await screen.findByText(text)).closest('tr')!);
    const room = await row('room-report');
    expect(room.getAllByText('Pokój: SQL Injection 101')[0]).toBeInTheDocument();
    expect(room.getAllByText('Zadanie: Logowanie')[0]).toBeInTheDocument();
    expect(room.getAllByRole('link', { name: '/rooms/4' })[0]).toHaveAttribute('href', '/rooms/4');
    expect(room.getByText(/gracz1, /)).toBeInTheDocument();
    expect(room.getByText('Otwarte')).toBeInTheDocument();
    const arena = await row('arena-report');
    expect(arena.getAllByText('Arena')[0]).toBeInTheDocument();
    expect(arena.getAllByText('Mecz 7f0c2d1e')[0]).toHaveAttribute('title', '7f0c2d1e-aaaa');
    expect((await row('gone-room')).getAllByText('Pokój: usunięty')[0]).toBeInTheDocument();
    const foreign = await row('foreign-path');
    expect(foreign.getAllByText('//evil.example/login')[0].tagName).toBe('SPAN');
    expect(foreign.queryByRole('link')).toBeNull();
    const lab = await row('lab-report');
    expect(lab.getAllByText('Laboratorium: Dyżur Zero')[0]).toBeInTheDocument();
    expect(lab.getAllByText(/Krok: 15\./)[0]).toBeInTheDocument();
    expect(lab.getAllByRole('link', { name: '/learn/ukos' })[0]).toHaveAttribute('href', '/learn/ukos');
    const oldLab = await row('old-lab-step');
    expect(oldLab.getAllByText('Krok: removed-step')[0]).toBeInTheDocument();
    expect(oldLab.queryByRole('link')).toBeNull();
  });

  it('updates roles and deletes an account from the current page', async () => {
    signIn('ADMIN');
    let users = [{ id: 2, username: 'page-user', email: 'page@example.com', role: 'USER', createdAt: '2026-10-01T00:00:00' }];
    let roleFails = true;
    server.use(
      http.get(`${API_URL}/api/admin/users`, () => HttpResponse.json({ items: users, page: 0, size: 50, hasNext: false })),
      http.put(`${API_URL}/api/admin/users/2/role`, async ({ request }) => {
        if (roleFails) return HttpResponse.json({ message: 'role refused' }, { status: 500 });
        const body = await request.json() as { role: string };
        users = users.map(user => ({ ...user, role: body.role }));
        return HttpResponse.json(users[0]);
      }),
      http.delete(`${API_URL}/api/admin/users/2`, () => { users = []; return new HttpResponse(null, { status: 204 }); }),
    );
    mountAdmin('/admin/users');
    await screen.findByText('page-user');
    const user = userEvent.setup();
    await user.click(screen.getByRole('combobox', { name: 'Rola użytkownika page-user' }));
    await user.click(screen.getByRole('option', { name: 'Ekspert' }));
    await screen.findByText('role refused');
    roleFails = false;
    await user.click(screen.getByRole('combobox', { name: 'Rola użytkownika page-user' }));
    await user.click(screen.getByRole('option', { name: 'Ekspert' }));
    await waitFor(() => expect(users[0].role).toBe('EXPERT'));
    await user.click(screen.getByRole('button', { name: 'Usuń page-user' }));
    await user.click(await screen.findByRole('button', { name: 'Usuń konto' }));
    await screen.findByText('Nie znaleziono użytkowników');
  });

  it('resolves, reopens and deletes bug reports and keeps failed actions available to retry', async () => {
    signIn('ADMIN');
    let reports = [bugReport({ id: 10, description: 'resolve-me' }), bugReport({ id: 11, description: 'delete-me' })];
    let statusFails = true;
    let deleteFails = true;
    server.use(
      http.get(`${API_URL}/api/admin/bug-reports`, ({ request }) => {
        const status = new URL(request.url).searchParams.get('status');
        return HttpResponse.json({ items: reports.filter(report => !status || report.status === status), page: 0, size: 50, hasNext: false });
      }),
      http.put(`${API_URL}/api/admin/bug-reports/:id/status`, async ({ params, request }) => {
        if (statusFails) return HttpResponse.json({ message: 'status refused' }, { status: 500 });
        const { status } = await request.json() as { status: BugReportStatus };
        reports = reports.map(report => report.id === Number(params.id) ? { ...report, status } : report);
        return HttpResponse.json(reports.find(report => report.id === Number(params.id)));
      }),
      http.delete(`${API_URL}/api/admin/bug-reports/11`, () => {
        if (deleteFails) return HttpResponse.json({ message: 'delete refused' }, { status: 500 });
        reports = reports.filter(report => report.id !== 11);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    mountAdmin('/admin/bug-reports');
    const user = userEvent.setup();
    const row = (text: string) => within(screen.getByText(text).closest('tr')!);
    await screen.findByText('resolve-me');
    await user.click(row('resolve-me').getByRole('button', { name: 'Oznacz jako rozwiązane' }));
    expect(await screen.findByText('status refused')).toBeInTheDocument();
    statusFails = false;
    await user.click(row('resolve-me').getByRole('button', { name: 'Oznacz jako rozwiązane' }));
    await waitFor(() => expect(screen.queryByText('resolve-me')).toBeNull());
    expect(screen.getByText('Zgłoszenie oznaczone jako rozwiązane.')).toBeInTheDocument();

    await user.click(row('delete-me').getByRole('button', { name: 'Usuń' }));
    await user.click(await screen.findByRole('button', { name: 'Usuń zgłoszenie' }));
    expect(await within(screen.getByRole('alertdialog')).findByText('delete refused')).toBeInTheDocument();
    deleteFails = false;
    await user.click(screen.getByRole('button', { name: 'Usuń zgłoszenie' }));
    await waitFor(() => expect(screen.queryByText('delete-me')).toBeNull());
    expect(screen.getByText('Zgłoszenie usunięte.')).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: 'Filtruj według statusu' }));
    await user.click(screen.getByRole('option', { name: 'Wszystkie' }));
    await screen.findByText('resolve-me');
    expect(row('resolve-me').getByText('Rozwiązane')).toBeInTheDocument();
    await user.click(row('resolve-me').getByRole('button', { name: 'Otwórz ponownie' }));
    expect(await screen.findByText('Zgłoszenie jest znowu otwarte.')).toBeInTheDocument();
    expect(row('resolve-me').getByText('Otwarte')).toBeInTheDocument();
    expect(reports[0].status).toBe('OPEN');
  });
});
