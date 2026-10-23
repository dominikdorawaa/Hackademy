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

  it('pages moderation reports without fetching the entire list', async () => {
    signIn('ADMIN');
    server.use(http.get(`${API_URL}/api/admin/reports`, ({ request }) => {
      const page = Number(new URL(request.url).searchParams.get('page'));
      return HttpResponse.json({ items: [{ id: page + 1, senderId: 1, senderUsername: 'reported', content: `report-page-${page}`, timestamp: '2026-10-01T00:00:00', reported: true }], page, size: 50, hasNext: page === 0 });
    }));
    mountAdmin('/admin/reports');
    await screen.findByText('report-page-0');
    await userEvent.click(screen.getByRole('button', { name: 'Następna' }));
    await screen.findByText('report-page-1');
    expect(screen.getByRole('button', { name: 'Następna' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Poprzednia' }));
    await screen.findByText('report-page-0');
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

  it('moderates reports from the loaded page and keeps failed actions available to retry', async () => {
    signIn('ADMIN');
    const reports = ['dismiss-me', 'delete-me', 'mute-me'].map((content, index) => ({ id: index + 10, senderId: 2, senderUsername: 'reported-user', content, timestamp: '2026-10-01T00:00:00', reported: true }));
    let deleteFails = true;
    let muted = false;
    server.use(
      http.get(`${API_URL}/api/admin/reports`, () => HttpResponse.json({ items: reports, page: 0, size: 50, hasNext: false })),
      http.post(`${API_URL}/api/admin/reports/10/dismiss`, () => new HttpResponse(null, { status: 204 })),
      http.delete(`${API_URL}/api/admin/reports/11`, () => deleteFails ? HttpResponse.json({ message: 'delete refused' }, { status: 500 }) : new HttpResponse(null, { status: 204 })),
      http.post(`${API_URL}/api/admin/users/2/mute`, () => { muted = true; return new HttpResponse(null, { status: 204 }); }),
    );
    mountAdmin('/admin/reports');
    const user = userEvent.setup();
    const row = (content: string) => within(screen.getByText(content).closest('tr')!);
    await screen.findByText('dismiss-me');
    await user.click(row('dismiss-me').getByRole('button', { name: 'Odrzuć' }));
    await waitFor(() => expect(screen.queryByText('dismiss-me')).toBeNull());
    await user.click(row('delete-me').getByRole('button', { name: 'Usuń' }));
    await user.click(await screen.findByRole('button', { name: 'Usuń wiadomość' }));
    await screen.findByText('delete refused');
    deleteFails = false;
    await user.click(row('delete-me').getByRole('button', { name: 'Usuń' }));
    await user.click(await screen.findByRole('button', { name: 'Usuń wiadomość' }));
    await waitFor(() => expect(screen.queryByText('delete-me')).toBeNull());
    await user.click(row('mute-me').getByRole('button', { name: 'Wycisz' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByRole('button', { name: 'Wycisz' }));
    await waitFor(() => expect(muted).toBe(true));
    await waitFor(() => expect(screen.queryByText('mute-me')).toBeNull());
  });
});
