import { setClerkSession } from '../../test/clerk';
import { configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import API_URL from '../../apiConfig';
import { server } from '../../test/mocks/server';
import { currentUserHandler } from '../../test/mocks/handlers';
import { pathsPageHandler, roomsPageHandler } from '../../test/mocks/adminLists';
import { createToken } from '../../test/fixtures/auth';
import { renderWithAuth } from '../../test/renderWithAuth';
import { findToast, queryToast } from '../../test/toasts';
import type { PathSummaryDto, RoomAdminSummaryDto } from '../../types/api';
import adminRoutes from './adminRoutes';

beforeAll(() => {
  configure({ asyncUtilTimeout: 8000 });
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = () => {};
  HTMLElement.prototype.releasePointerCapture = () => {};
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});
afterAll(() => configure({ asyncUtilTimeout: 1000 }));

const pad = (n: number) => String(n).padStart(3, '0');
const makeRooms = (count: number): RoomAdminSummaryDto[] => Array.from({ length: count }, (_, i) => ({
  id: i + 1, title: `Pokój ${pad(i + 1)}`, category: 'Seed', difficulty: 'EASY', points: 10, requiresVpn: false,
  roomType: (i + 1) % 3 === 0 ? 'CTF' : 'PATH', paths: [],
}));
const makePaths = (count: number): PathSummaryDto[] => Array.from({ length: count }, (_, i) => ({
  id: i + 1, title: `Ścieżka ${pad(i + 1)}`, description: '', bannerUrl: null, hasBanner: false, roomsCount: 0, enrolled: false, published: true,
}));

function mount(role: 'ADMIN' | 'EXPERT', path: string) {
  setClerkSession(createToken(role));
  server.use(currentUserHandler(role));
  return renderWithAuth(<>{adminRoutes}</>, path);
}
const roomLinks = () => screen.getAllByRole('link', { name: /^Pokój \d+$/ });
const pathLinks = () => screen.getAllByRole('link', { name: /^Ścieżka \d+$/ });
const filter = (name: RegExp) => within(screen.getByRole('group', { name: 'Filtruj po typie' })).getByRole('button', { name });
const deleteRoomHandler = (rooms: RoomAdminSummaryDto[]) => http.delete(`${API_URL}/api/admin/rooms/:id`, ({ params }) => {
  rooms.splice(rooms.findIndex((room) => room.id === Number(params.id)), 1);
  return new HttpResponse(null, { status: 204 });
});

describe('rooms list paging', { timeout: 30000 }, () => {
  it('shows the first 50 of 120 rooms with server counters and loads the next page', async () => {
    const requests: URL[] = [];
    server.use(roomsPageHandler(makeRooms(120), requests));
    const user = userEvent.setup();
    mount('ADMIN', '/admin/paths/rooms');

    expect(await screen.findByRole('link', { name: 'Pokój 001' })).toBeInTheDocument();
    expect(roomLinks()).toHaveLength(50);
    expect(screen.queryByRole('link', { name: 'Pokój 051' })).toBeNull();
    expect(requests[0].searchParams.get('size')).toBe('50');
    expect(filter(/Wszystkie/)).toHaveTextContent(/^Wszystkie\s*120$/);
    expect(filter(/Teoria/)).toHaveTextContent(/^Teoria\s*80$/);
    expect(filter(/CTF/)).toHaveTextContent(/^CTF\s*40$/);
    expect(screen.getByRole('button', { name: 'Poprzednia' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Następna' }));
    expect(await screen.findByRole('link', { name: 'Pokój 051' })).toBeInTheDocument();
    expect(screen.getByText('Strona 2')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Pokój 001' })).toBeNull();
    expect(requests.at(-1)!.searchParams.get('page')).toBe('1');
    await user.click(screen.getByRole('button', { name: 'Następna' }));
    expect(await screen.findByRole('link', { name: 'Pokój 120' })).toBeInTheDocument();
    expect(roomLinks()).toHaveLength(20);
    expect(screen.getByRole('button', { name: 'Następna' })).toBeDisabled();
  });

  it('finds a room from another page and returns to the first page when the phrase or type changes', async () => {
    const requests: URL[] = [];
    server.use(roomsPageHandler(makeRooms(120), requests));
    const user = userEvent.setup();
    mount('ADMIN', '/admin/paths/rooms');
    await screen.findByRole('link', { name: 'Pokój 001' });
    await user.click(screen.getByRole('button', { name: 'Następna' }));
    await screen.findByText('Strona 2');

    await user.type(screen.getByLabelText('Szukaj pokoju'), '117');
    expect(await screen.findByRole('link', { name: 'Pokój 117' })).toBeInTheDocument();
    expect(roomLinks()).toHaveLength(1);
    expect(screen.getByText('Strona 1')).toBeInTheDocument();
    expect(requests.at(-1)!.searchParams.get('query')).toBe('117');
    expect(requests.at(-1)!.searchParams.get('page')).toBe('0');
    expect(filter(/Wszystkie/)).toHaveTextContent(/^Wszystkie\s*1$/);
    expect(filter(/CTF/)).toHaveTextContent(/^CTF\s*1$/);

    await user.clear(screen.getByLabelText('Szukaj pokoju'));
    await screen.findByRole('link', { name: 'Pokój 001' });
    await user.click(screen.getByRole('button', { name: 'Następna' }));
    await screen.findByText('Strona 2');
    await user.click(filter(/CTF/));
    expect(await screen.findByText('Strona 1')).toBeInTheDocument();
    await waitFor(() => expect(roomLinks()).toHaveLength(40));
    expect(requests.at(-1)!.searchParams.get('type')).toBe('CTF');
    expect(requests.at(-1)!.searchParams.get('page')).toBe('0');
    expect(filter(/Wszystkie/)).toHaveTextContent(/^Wszystkie\s*120$/);
    expect(filter(/CTF/)).toHaveTextContent(/^CTF\s*40$/);
  });

  it('takes the type counters from the server response', async () => {
    server.use(http.get(`${API_URL}/api/admin/rooms`, () => HttpResponse.json({
      items: makeRooms(1), page: 0, size: 50, hasNext: false, counts: { PATH: 70, CTF: 30 },
    })));
    mount('ADMIN', '/admin/paths/rooms');
    await screen.findByRole('link', { name: 'Pokój 001' });
    expect(filter(/Wszystkie/)).toHaveTextContent(/^Wszystkie\s*100$/);
    expect(filter(/Teoria/)).toHaveTextContent(/^Teoria\s*70$/);
    expect(filter(/CTF/)).toHaveTextContent(/^CTF\s*30$/);
  });

  it('goes back a page after deleting the only room on the last page', async () => {
    const rooms = makeRooms(51);
    const requests: URL[] = [];
    server.use(roomsPageHandler(rooms, requests), deleteRoomHandler(rooms));
    const user = userEvent.setup();
    mount('ADMIN', '/admin/paths/rooms');
    await screen.findByRole('link', { name: 'Pokój 001' });
    await user.click(screen.getByRole('button', { name: 'Następna' }));
    expect(await screen.findByRole('link', { name: 'Pokój 051' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Usuń Pokój 051' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Usuń pokój' }));
    await findToast('Pokój „Pokój 051” został usunięty.');
    expect(await screen.findByText('Strona 1')).toBeInTheDocument();
    await waitFor(() => expect(roomLinks()).toHaveLength(50));
    expect(screen.getByRole('button', { name: 'Następna' })).toBeDisabled();
    expect(requests.at(-1)!.searchParams.get('page')).toBe('0');
    expect(screen.queryByText(/Na tej stronie nie ma/)).toBeNull();
  });

  it('refreshes the current page after deleting a room so the next one moves up', async () => {
    const rooms = makeRooms(51);
    server.use(roomsPageHandler(rooms), deleteRoomHandler(rooms));
    const user = userEvent.setup();
    mount('ADMIN', '/admin/paths/rooms');
    await screen.findByRole('link', { name: 'Pokój 001' });

    await user.click(screen.getByRole('button', { name: 'Usuń Pokój 010' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Usuń pokój' }));
    expect(await screen.findByRole('link', { name: 'Pokój 051' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Pokój 010' })).toBeNull();
    expect(roomLinks()).toHaveLength(50);
    expect(screen.getByText('Strona 1')).toBeInTheDocument();
    expect(filter(/Wszystkie/)).toHaveTextContent(/^Wszystkie\s*50$/);
  });

  it('keeps the newest request when an older page arrives late and explains an empty later page', async () => {
    let first = true;
    server.use(http.get(`${API_URL}/api/admin/rooms`, async ({ request }) => {
      const url = new URL(request.url);
      if (first) { first = false; await delay(400); return HttpResponse.json({ items: makeRooms(2), page: 0, size: 50, hasNext: true, counts: { PATH: 2, CTF: 0 } }); }
      if (url.searchParams.get('type') === 'CTF') return HttpResponse.json({ items: [], page: 0, size: 50, hasNext: true, counts: { PATH: 2, CTF: 0 } });
      return HttpResponse.json({ items: [], page: Number(url.searchParams.get('page')), size: 50, hasNext: false, counts: { PATH: 2, CTF: 0 } });
    }));
    const user = userEvent.setup();
    mount('ADMIN', '/admin/paths/rooms');
    await user.click(await screen.findByRole('button', { name: /CTF/ }));
    expect(await screen.findByText('Brak pasujących pokoi')).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(screen.queryByRole('link', { name: 'Pokój 001' })).toBeNull();

    await user.click(filter(/Wszystkie/));
    expect(await screen.findByText('Nie ma jeszcze pokoi.')).toBeInTheDocument();
  });

  it('shows an empty later page without the create action', async () => {
    server.use(http.get(`${API_URL}/api/admin/rooms`, ({ request }) => {
      const page = Number(new URL(request.url).searchParams.get('page'));
      return HttpResponse.json(page === 0
        ? { items: makeRooms(1), page, size: 50, hasNext: true, counts: { PATH: 1, CTF: 0 } }
        : { items: [], page, size: 50, hasNext: false, counts: { PATH: 1, CTF: 0 } });
    }));
    const user = userEvent.setup();
    mount('ADMIN', '/admin/paths/rooms');
    await screen.findByRole('link', { name: 'Pokój 001' });
    await user.click(screen.getByRole('button', { name: 'Następna' }));
    expect(await screen.findByText('Na tej stronie nie ma pokoi.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Utwórz pierwszy pokój' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Poprzednia' }));
    expect(await screen.findByRole('link', { name: 'Pokój 001' })).toBeInTheDocument();
  });

  it('reports a failed load and ignores a failure that arrives after a newer request', async () => {
    let calls = 0;
    server.use(http.get(`${API_URL}/api/admin/rooms`, async () => {
      calls += 1;
      if (calls === 1) { await delay(400); return HttpResponse.json({ message: 'Stary błąd' }, { status: 500 }); }
      return HttpResponse.json({ message: 'Baza nie odpowiada' }, { status: 500 });
    }));
    const user = userEvent.setup();
    mount('ADMIN', '/admin/paths/rooms');
    await user.click(await screen.findByRole('button', { name: /CTF/ }));
    expect(await screen.findByText('Baza nie odpowiada')).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(screen.queryByText('Stary błąd')).toBeNull();
  });
});

describe('paths list paging', { timeout: 30000 }, () => {
  it('pages the paths and searches outside the current page from the first page', async () => {
    const requests: URL[] = [];
    server.use(pathsPageHandler(makePaths(55), requests));
    const user = userEvent.setup();
    mount('EXPERT', '/admin/paths');

    expect(await screen.findByRole('link', { name: 'Ścieżka 001' })).toBeInTheDocument();
    expect(pathLinks()).toHaveLength(50);
    expect(requests[0].searchParams.get('size')).toBe('50');
    await user.click(screen.getByRole('button', { name: 'Następna' }));
    expect(await screen.findByRole('link', { name: 'Ścieżka 055' })).toBeInTheDocument();
    expect(pathLinks()).toHaveLength(5);
    expect(screen.getByText('Strona 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Następna' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Poprzednia' }));
    await screen.findByRole('link', { name: 'Ścieżka 001' });
    await user.click(screen.getByRole('button', { name: 'Następna' }));
    await screen.findByText('Strona 2');
    await user.type(screen.getByLabelText('Szukaj ścieżki'), '012');
    expect(await screen.findByRole('link', { name: 'Ścieżka 012' })).toBeInTheDocument();
    expect(pathLinks()).toHaveLength(1);
    expect(screen.getByText('Strona 1')).toBeInTheDocument();
    expect(requests.at(-1)!.searchParams.get('query')).toBe('012');
    expect(requests.at(-1)!.searchParams.get('page')).toBe('0');

    await user.clear(screen.getByLabelText('Szukaj ścieżki'));
    await user.type(screen.getByLabelText('Szukaj ścieżki'), 'nic takiego');
    expect(await screen.findByText('Brak pasujących ścieżek')).toBeInTheDocument();
  });

  it('goes back a page after deleting the only path on the last page and refreshes after other deletions', async () => {
    const paths = makePaths(52);
    const requests: URL[] = [];
    server.use(pathsPageHandler(paths, requests), http.delete(`${API_URL}/api/admin/paths/:id`, ({ params }) => {
      paths.splice(paths.findIndex((path) => path.id === Number(params.id)), 1);
      return new HttpResponse(null, { status: 204 });
    }));
    const user = userEvent.setup();
    mount('ADMIN', '/admin/paths');
    await screen.findByRole('link', { name: 'Ścieżka 001' });
    await user.click(screen.getByRole('button', { name: 'Następna' }));
    await screen.findByRole('link', { name: 'Ścieżka 052' });

    await user.click(screen.getByRole('button', { name: 'Usuń Ścieżka 051' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Usuń ścieżkę' }));
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Ścieżka 051' })).toBeNull());
    expect(pathLinks()).toHaveLength(1);
    expect(screen.getByText('Strona 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Usuń Ścieżka 052' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Usuń ścieżkę' }));
    await findToast(/Ścieżka „Ścieżka 052” została usunięta/);
    expect(await screen.findByText('Strona 1')).toBeInTheDocument();
    await waitFor(() => expect(pathLinks()).toHaveLength(50));
    expect(requests.at(-1)!.searchParams.get('page')).toBe('0');
    expect(screen.getByRole('button', { name: 'Następna' })).toBeDisabled();
  });

  it('explains an empty later page and ignores a late older response', async () => {
    let calls = 0;
    server.use(http.get(`${API_URL}/api/admin/paths`, async ({ request }) => {
      calls += 1;
      const page = Number(new URL(request.url).searchParams.get('page'));
      if (calls === 1) { await delay(400); return HttpResponse.json({ message: 'Stary błąd' }, { status: 500 }); }
      if (calls === 2) { await delay(900); return HttpResponse.json({ items: makePaths(3), page, size: 50, hasNext: true }); }
      return HttpResponse.json(page === 0 ? { items: makePaths(1), page, size: 50, hasNext: true } : { items: [], page, size: 50, hasNext: false });
    }));
    const user = userEvent.setup();
    mount('ADMIN', '/admin/paths');
    await user.type(await screen.findByLabelText('Szukaj ścieżki'), 'a');
    await new Promise((resolve) => setTimeout(resolve, 350));
    await user.clear(screen.getByLabelText('Szukaj ścieżki'));
    expect(await screen.findByRole('link', { name: 'Ścieżka 001' })).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 900));
    expect(screen.queryByText('Stary błąd')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Ścieżka 003' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Następna' }));
    expect(await screen.findByText('Na tej stronie nie ma ścieżek.')).toBeInTheDocument();
  });

  it('reports a failed path load', async () => {
    server.use(http.get(`${API_URL}/api/admin/paths`, () => HttpResponse.json({ message: 'Baza nie odpowiada' }, { status: 500 })));
    mount('ADMIN', '/admin/paths');
    expect(await screen.findByText('Baza nie odpowiada')).toBeInTheDocument();
    expect(queryToast('Baza nie odpowiada')).toBeNull();
  });
});
