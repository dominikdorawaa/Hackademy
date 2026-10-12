import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, createRoutesFromElements, Outlet, Route, RouterProvider } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { AuthProvider } from '../../context/AuthContext';
import { ThemeProvider } from '../../context/ThemeContext';
import { server } from '../../test/mocks/server';
import { currentUserHandler } from '../../test/mocks/handlers';
import { createToken } from '../../test/fixtures/auth';
import API_URL from '../../apiConfig';
import adminRoutes from './adminRoutes';
import * as contentApi from '../../services/contentApi';
import type { PathAdminDetailDto } from '../../types/api';

const path: PathAdminDetailDto = { id: 5, title: 'Web', description: '', bannerUrl: null, hasBanner: false, revision: 2, contentRevision: 3, published: false,
  chapters: [{ id: 11, title: 'Wstęp', roomIds: [] }] };
const room = { id: 9, title: 'Pokój', description: 'Treść', shortDescription: '', difficulty: 'EASY' as const, category: 'Path', points: 50, flag: '', solutionsCount: 0,
  requiresVpn: false, roomType: 'PATH' as const, hints: ['Podpowiedź'], published: false, contentRevision: 0, createdAt: '2026-10-10T10:00:00', updatedAt: null };
beforeAll(() => {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  window.matchMedia = ((media: string) => ({ matches: false, media, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
});
beforeEach(() => {
  localStorage.setItem('token', createToken('ADMIN'));
  server.use(currentUserHandler('ADMIN'), http.get(`${API_URL}/api/admin/rooms`, () => HttpResponse.json([])), http.get(`${API_URL}/api/admin/paths`, () => HttpResponse.json([])),
    http.get(`${API_URL}/api/admin/paths/5`, () => HttpResponse.json(path)), http.get(`${API_URL}/api/admin/content/rooms/9`, () => HttpResponse.json({ room, tasks: { revision: 0, tasks: [] } })));
});
afterEach(() => vi.restoreAllMocks());
function mount(initial: string, entries = [initial]) {
  const router = createMemoryRouter(createRoutesFromElements(<Route element={<ThemeProvider><AuthProvider><Outlet /></AuthProvider></ThemeProvider>}>
    {adminRoutes}<Route path="/" element={<p>Główna</p>} /><Route path="/login" element={<p>Logowanie</p>} />
  </Route>), { initialEntries: entries, initialIndex: entries.length - 1 });
  render(<RouterProvider router={router} />); return router;
}

describe('draft editors and guarded navigation', () => {
  it('opens new path directly in the complete editor and shows counters before typing', async () => {
    const user = userEvent.setup(); const router = mount('/admin/paths');
    await user.click(await screen.findByRole('link', { name: 'Nowa ścieżka' }));
    expect(router.state.location.pathname).toBe('/admin/paths/new');
    expect(await screen.findByLabelText('Tytuł *')).toHaveValue('');
    expect(screen.getByText('0/120')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Utwórz pokój' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('keeps edits when continuing and discards them only when explicitly leaving', async () => {
    const user = userEvent.setup(); const router = mount('/admin/paths/5');
    await user.type(await screen.findByLabelText('Tytuł *'), ' lokalny');
    await user.click(screen.getByRole('link', { name: 'Pokoje CTF' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Kontynuuj edycję' }));
    expect(router.state.location.pathname).toBe('/admin/paths/5');
    expect(screen.getByLabelText('Tytuł *')).toHaveValue('Web lokalny');
    await user.click(screen.getByRole('link', { name: 'Pokoje CTF' }));
    await user.click(screen.getByRole('button', { name: 'Wyjdź bez zapisywania' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/ctf'));
  });
  it('does not navigate on failed save-and-leave, focuses first invalid field and keeps all data', async () => {
    const user = userEvent.setup(); const router = mount('/admin/paths/5');
    const title = await screen.findByLabelText('Tytuł *'); await user.clear(title);
    await user.type(screen.getByLabelText('Nazwa rozdziału 1 *'), ' lokalny');
    await user.click(screen.getByRole('button', { name: 'Podgląd' }));
    await user.click(screen.getByRole('button', { name: 'Zapisz i przejdź dalej' }));
    expect(await screen.findByText('To pole jest wymagane')).toBeInTheDocument();
    await waitFor(() => expect(title).toHaveFocus());
    expect(router.state.location.pathname).toBe('/admin/paths/5');
    expect(screen.getByLabelText('Nazwa rozdziału 1 *')).toHaveValue('Wstęp lokalny');
  });
  it('blocks browser back and native refresh, while successful save preserves draft status before navigation', async () => {
    const user = userEvent.setup(); const router = mount('/admin/paths/5', ['/admin/paths', '/admin/paths/5']);
    const save = vi.spyOn(contentApi, 'savePath').mockResolvedValue({ ...path, title: 'Web nowy', revision: 3, contentRevision: 5 });
    await user.type(await screen.findByLabelText('Tytuł *'), ' nowy');
    const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); expect(event.defaultPrevented).toBe(true);
    await router.navigate(-1);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zapisz i przejdź dalej' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/paths'));
    expect(save.mock.calls[0][1].published).toBe(false);
  });
  it('saves a new path and chapter before opening the full room form with the exact context', async () => {
    const user = userEvent.setup(); const router = mount('/admin/paths/new');
    vi.spyOn(contentApi, 'savePath').mockResolvedValue({ ...path, title: 'Nowa', chapters: [{ id: 11, title: 'Rozdział 1', roomIds: [] }] });
    server.use(http.get(`${API_URL}/api/admin/paths/5`, () => HttpResponse.json({ ...path, title: 'Nowa' })));
    await user.type(await screen.findByLabelText('Tytuł *'), 'Nowa');
    await user.click(screen.getByRole('button', { name: 'Utwórz pokój' }));
    await user.click(screen.getByRole('button', { name: 'Zapisz i przejdź dalej' }));
    await waitFor(() => expect(router.state.location.search).toBe('?pathId=5&chapterId=11&pathRevision=3')); 
    expect(await screen.findByText(/Ścieżka: Nowa → Rozdział:/)).toBeInTheDocument();
    for (const label of ['Tytuł *', 'Opis', 'Flaga', 'Plik do pobrania', 'Wymaga VPN']) expect(screen.getByLabelText(label)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dodaj zadanie' })).toBeInTheDocument();
  });
  it('opens an atomic new-parent room form after discarding an unsaved new path', async () => {
    const user = userEvent.setup(); mount('/admin/paths/new');
    await user.type(await screen.findByLabelText('Tytuł *'), 'Odrzucony tytuł');
    await user.click(screen.getByRole('button', { name: 'Utwórz pokój' }));
    await user.click(screen.getByRole('button', { name: 'Wyjdź bez zapisywania' }));
    expect(await screen.findByLabelText('Tytuł ścieżki *')).toHaveValue('');
    expect(screen.getByLabelText('Nazwa rozdziału *')).toHaveValue('Rozdział 1');
    expect(screen.getByLabelText('Tytuł *')).toHaveValue('');
  });
  it('shows pasted overflow without truncating content and preserves task and hint edits after server failure', async () => {
    const user = userEvent.setup(); mount('/admin/paths/rooms/9');
    const title = await screen.findByLabelText('Tytuł *');
    fireEvent.change(title, { target: { value: 'x'.repeat(256) } });
    expect(title).toHaveValue('x'.repeat(256)); expect(screen.getByText('256/255')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zapisz szkic' })); expect(await screen.findByText('Maksymalnie 255 znaków')).toBeInTheDocument();
    await user.clear(title); await user.type(title, 'Pokój');
    await user.click(screen.getByRole('button', { name: 'Dodaj zadanie' }));
    await user.type(screen.getByLabelText('Tytuł zadania *'), 'Pierwsze');
    await user.type(screen.getByLabelText('Podpowiedź 1 *'), ' lokalna');
    vi.spyOn(contentApi, 'saveRoom').mockRejectedValue(new contentApi.ContentError('Awaria zapisu'));
    await user.click(screen.getByRole('button', { name: 'Zapisz szkic' }));
    expect(await screen.findByText('Awaria zapisu')).toBeInTheDocument();
    expect(screen.getByLabelText('Tytuł zadania *')).toHaveValue('Pierwsze');
    expect(screen.getByLabelText('Podpowiedź 1 *')).toHaveValue('Podpowiedź lokalna');
  });
  it('adds a room from the side pool to the selected new chapter and saves its assignment', async () => {
    server.use(http.get(`${API_URL}/api/admin/rooms`, () => HttpResponse.json([{ ...room, pathId: null, pathTitle: null }])));
    const user = userEvent.setup(); mount('/admin/paths/5');
    const save = vi.spyOn(contentApi, 'savePath').mockResolvedValue(path);
    await screen.findByLabelText('Tytuł *');
    await user.click(screen.getByRole('button', { name: 'Dodaj rozdział' }));
    await user.click(screen.getByRole('button', { name: 'Dodaj Pokój do rozdziału' }));
    expect(screen.getByRole('list', { name: 'Pokoje rozdziału 2' })).toHaveTextContent('Pokój');
    expect(screen.queryByRole('button', { name: 'Dodaj Pokój do rozdziału' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zapisz szkic' }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls[0][1].chapters).toEqual([{ id: 11, title: 'Wstęp', roomIds: [] }, { id: null, title: 'Rozdział 2', roomIds: [9] }]);
  });
  it('includes edited tasks in save-and-preview and leaves invalid task fields in the editor', async () => {
    const user = userEvent.setup(); const router = mount('/admin/paths/rooms/9');
    await screen.findByLabelText('Tytuł *'); await user.click(screen.getByRole('button', { name: 'Dodaj zadanie' }));
    await user.click(screen.getByRole('button', { name: 'Podgląd' })); await user.click(screen.getByRole('button', { name: 'Zapisz i przejdź dalej' }));
    expect(await screen.findByText('To pole jest wymagane')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Tytuł zadania *')).toHaveFocus());
    expect(router.state.location.pathname).toBe('/admin/paths/rooms/9');
  });
});

describe('administrative preview', () => {
  it('uses the player room view, reveals saved draft hints and never writes player progress', async () => {
    const writes: string[] = [];
    server.use(http.get(`${API_URL}/api/admin/content/rooms/9/preview`, () => HttpResponse.json({ ...room, solved: false, fileName: null,
      unlockedHintIds: [1], hints: [{ id: 1, description: 'Tajna podpowiedź' }], tasks: [{ id: 3, title: 'Zadanie', content: '<strong>Treść HTML</strong>', question: null, completed: false }] })),
      http.post(`${API_URL}/api/rooms/:id/*`, ({ request }) => { writes.push(request.url); return HttpResponse.json({ success: true }); }));
    const user = userEvent.setup(); mount('/admin/preview/rooms/9?kind=PATH');
    expect(await screen.findByRole('heading', { name: 'Pokój', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Treść HTML').tagName).toBe('STRONG');
    expect(screen.getByText('Tajna podpowiedź')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Przeczytane|Ukończ zadanie|Oznacz/i }));
    expect(writes).toEqual([]);
  });
  it('shows chapters and rooms in order and opens a draft room with a return to the path preview', async () => {
    server.use(http.get(`${API_URL}/api/admin/content/paths/5/preview`, () => HttpResponse.json({ ...path, enrolled: true, rooms: [], chapters: [{ id: 11, title: 'Wstęp', totalRooms: 1, solvedRooms: 0, rooms: [{ ...room, solved: false, locked: false }] }] })),
      http.get(`${API_URL}/api/admin/content/rooms/9/preview`, () => HttpResponse.json({ ...room, solved: false, hints: [], unlockedHintIds: [], tasks: [], fileName: null })));
    const user = userEvent.setup(); const router = mount('/admin/preview/paths/5');
    expect(await screen.findByRole('heading', { name: 'Web', level: 1 })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Start/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/preview/rooms/9'));
    await screen.findByRole('heading', { name: 'Pokój', level: 1 });
    await user.click(screen.getByRole('button', { name: /Powrót/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/preview/paths/5'));
  });
});
