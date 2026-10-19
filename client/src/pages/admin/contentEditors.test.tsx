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
function mount(initial: string, entries: (string | { pathname: string; state?: unknown })[] = [initial]) {
  const router = createMemoryRouter(createRoutesFromElements(<Route element={<ThemeProvider><AuthProvider><Outlet /></AuthProvider></ThemeProvider>}>
    {adminRoutes}<Route path="/" element={<p>Główna</p>} /><Route path="/login" element={<p>Logowanie</p>} />
  </Route>), { initialEntries: entries, initialIndex: entries.length - 1 });
  render(<RouterProvider router={router} />); return router;
}

describe('draft editors and guarded navigation', () => {
  it('guards room import against unsaved edits and reloads the existing path after success', async () => {
    const user = userEvent.setup(); mount('/admin/paths/5');
    const importedPath = { ...path, revision: 3, contentRevision: 4, chapters: [{ id: 11, title: 'Wstęp', roomIds: [9] }] };
    vi.spyOn(contentApi, 'importPathRooms').mockResolvedValue(importedPath);
    const save = vi.spyOn(contentApi, 'savePath').mockResolvedValue({ ...path, title: 'Web zmieniony', revision: 3, contentRevision: 4 });
    await user.type(await screen.findByLabelText('Tytuł *'), ' zmieniony');
    await user.click(screen.getByRole('button', { name: 'Importuj pokoje z JSON' }));
    expect(await screen.findByRole('dialog', { name: 'Niezapisane zmiany' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Kontynuuj edycję' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Importuj pokoje z JSON' }));
    await user.click(screen.getByRole('button', { name: 'Zapisz i przejdź dalej' }));
    expect(await screen.findByRole('dialog', { name: 'Dodaj pokoje z JSON' })).toBeInTheDocument();
    expect(screen.getByText('Ścieżka: Web zmieniony')).toBeInTheDocument();
    const file = new File(['{"rooms":[]}'], 'rooms.json', { type: 'application/json' });
    await user.upload(screen.getByLabelText('Plik JSON (do 5 MB)'), file);
    server.use(http.get(`${API_URL}/api/admin/paths/5`, () => HttpResponse.json(importedPath)),
      http.get(`${API_URL}/api/admin/rooms`, () => HttpResponse.json([{ ...room, pathId: 5 }])));
    await user.click(screen.getByRole('button', { name: 'Dodaj pokoje jako szkice' }));
    expect(await screen.findByText(/Dodano pokoje jako szkice/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('list', { name: 'Pokoje rozdziału 1' })).toHaveTextContent('Pokój'));
    expect(contentApi.importPathRooms).toHaveBeenCalledWith(5, { chapterId: 11, contentRevision: 4, chaptersRevision: 3 }, file, expect.any(String));
    expect(save).toHaveBeenCalledOnce();
    const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); expect(event.defaultPrevented).toBe(false);
  });
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
  it('focuses the first invalid context field in visual order without losing room edits', async () => {
    const user = userEvent.setup(); mount('/admin/paths/rooms/new', [{ pathname: '/admin/paths/rooms/new', state: { chapterIndex: 0, parentDraft: { revision: 0, chaptersRevision: 0,
      title: '', description: '', bannerUrl: null, published: true, chapters: [{ id: null, title: 'Rozdział', roomIds: [] }] } } }]);
    await user.type(await screen.findByLabelText('Tytuł *'), 'Zachowany pokój');
    await user.click(screen.getByRole('button', { name: 'Zapisz szkic' }));
    await waitFor(() => expect(screen.getByLabelText('Tytuł ścieżki *')).toHaveFocus());
    expect(screen.getAllByText('To pole jest wymagane')).toHaveLength(2);
    expect(screen.getByLabelText('Tytuł *')).toHaveValue('Zachowany pokój');
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
  it('defaults new paths to open and saves the selected unlock mode', async () => {
    const user = userEvent.setup(); mount('/admin/paths/new');
    expect(await screen.findByLabelText('Tryb odblokowania')).toHaveValue('OPEN');
    const save = vi.spyOn(contentApi, 'savePath').mockResolvedValue({ ...path, unlockMode: 'ROOM' });
    await user.type(screen.getByLabelText('Tytuł *'), 'Kolejka');
    await user.selectOptions(screen.getByLabelText('Tryb odblokowania'), 'ROOM');
    expect(screen.getByText(/jedną kolejkę przez całą ścieżkę/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zapisz szkic' }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls[0][1].unlockMode).toBe('ROOM');
  });
  it('loads the saved unlock mode of an existing path', async () => {
    server.use(http.get(`${API_URL}/api/admin/paths/5`, () => HttpResponse.json({ ...path, unlockMode: 'CHAPTER' })));
    mount('/admin/paths/5');
    expect(await screen.findByLabelText('Tryb odblokowania')).toHaveValue('CHAPTER');
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
  it('resets the native upload field after saving so the same file can be selected again', async () => {
    const user = userEvent.setup(); mount('/admin/paths/rooms/9'); await screen.findByLabelText('Tytuł *');
    const file = new File(['training'], 'training.bin', { type: 'application/octet-stream' });
    const save = vi.spyOn(contentApi, 'saveRoom').mockResolvedValue({ room: { ...room, contentRevision: 1 }, tasks: { revision: 0, tasks: [] } });
    await user.upload(screen.getByLabelText('Plik do pobrania'), file);
    await user.click(screen.getByRole('button', { name: 'Zapisz szkic' })); await screen.findByText('Zapisano szkic pokoju.');
    expect((screen.getByLabelText('Plik do pobrania') as HTMLInputElement).files).toHaveLength(0);
    await user.upload(screen.getByLabelText('Plik do pobrania'), file);
    await user.click(screen.getByRole('button', { name: 'Zapisz szkic' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save.mock.calls[1][2]).toBe(file);
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

describe('room title and scoring rules', () => {
  it('shows a duplicate title reported by the backend next to the title field', async () => {
    server.use(http.put(`${API_URL}/api/admin/content/rooms/9`, () => HttpResponse.json({ message: 'Rozdział tego pokoju ma już pokój o tym tytule', fields: { title: 'Rozdział tego pokoju ma już pokój o tym tytule' } }, { status: 409 })));
    const user = userEvent.setup(); mount('/admin/paths/rooms/9');
    const title = await screen.findByLabelText('Tytuł *');
    await user.clear(title); await user.type(title, 'Wstęp');
    await user.click(screen.getByRole('button', { name: 'Zapisz szkic' }));
    expect(await screen.findByText('Rozdział tego pokoju ma już pokój o tym tytule', { selector: '#content-title-error' })).toBeInTheDocument();
    await waitFor(() => expect(title).toHaveFocus());
    expect(title).toHaveValue('Wstęp');
  });
  it('rejects reserved tutorial titles before saving a new room', async () => {
    const save = vi.spyOn(contentApi, 'saveRoom');
    const user = userEvent.setup(); mount('/admin/ctf/new');
    await user.type(await screen.findByLabelText('Tytuł *'), ' tutorial VPN ');
    await user.click(screen.getByRole('button', { name: 'Zapisz szkic' }));
    expect(await screen.findByText('Tytuły „Tutorial VM” i „Tutorial VPN” są zarezerwowane dla pokoi samouczka')).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });
  it('keeps the title of an existing tutorial room editable', async () => {
    server.use(http.get(`${API_URL}/api/admin/content/rooms/9`, () => HttpResponse.json({ room: { ...room, title: 'Tutorial VM', roomType: 'CTF', category: 'Tutorial' }, tasks: { revision: 0, tasks: [] } })));
    const save = vi.spyOn(contentApi, 'saveRoom').mockResolvedValue({ room: { ...room, title: 'Tutorial VM', roomType: 'CTF', category: 'Tutorial' }, tasks: { revision: 0, tasks: [] } });
    const user = userEvent.setup(); mount('/admin/ctf/9');
    await user.type(await screen.findByLabelText('Opis'), ' nowy');
    await user.click(screen.getByRole('button', { name: 'Zapisz szkic' }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls[0][1].title).toBe('Tutorial VM');
  });
  it('shows CTF points derived from difficulty without an editable points field', async () => {
    const user = userEvent.setup(); mount('/admin/ctf/new');
    await screen.findByLabelText('Tytuł *');
    expect(screen.queryByLabelText('Punkty *')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Trudność *'), 'INSANE');
    expect(screen.getByText('200 pkt')).toBeInTheDocument();
  });
  it('shows a duplicate room title in a chapter reported by the backend', async () => {
    server.use(http.get(`${API_URL}/api/admin/rooms`, () => HttpResponse.json([{ ...room, pathId: 5, pathTitle: 'Web' }])),
      http.get(`${API_URL}/api/admin/paths/5`, () => HttpResponse.json({ ...path, chapters: [{ id: 11, title: 'Wstęp', roomIds: [9] }] })),
      http.put(`${API_URL}/api/admin/content/paths/5`, () => HttpResponse.json({ message: 'Rozdział 1 zawiera już pokój „Pokój”', fields: { 'chapters.0.rooms': 'Rozdział 1 zawiera już pokój „Pokój”' } }, { status: 409 })));
    const user = userEvent.setup(); mount('/admin/paths/5');
    await user.type(await screen.findByLabelText('Nazwa rozdziału 1 *'), ' lokalny');
    await user.click(screen.getByRole('button', { name: 'Zapisz szkic' }));
    expect(await screen.findAllByText('Rozdział 1 zawiera już pokój „Pokój”')).not.toHaveLength(0);
    expect(screen.getByLabelText('Nazwa rozdziału 1 *')).toHaveValue('Wstęp lokalny');
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
    await user.click(screen.getByRole('button', { name: /Ukończ pokój/ }));
    expect(await screen.findByText('Podgląd: postęp i punkty nie są zapisywane.')).toBeInTheDocument();
    expect(writes).toEqual([]);
  });
  it('simulates flag and hint actions locally and downloads only from the protected preview endpoint', async () => {
    const writes: string[] = []; let downloads = 0;
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:preview-file' });
    const anchor = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    server.use(http.get(`${API_URL}/api/admin/content/rooms/9`, () => HttpResponse.json({ room: { ...room, roomType: 'CTF' }, tasks: { revision: 0, tasks: [] } })), http.get(`${API_URL}/api/admin/content/rooms/9/preview`, () => HttpResponse.json({ ...room, solved: false, fileName: 'training.bin',
      unlockedHintIds: [], hints: [{ id: 1, description: 'Podpowiedź do testu' }], tasks: [] })),
      http.get(`${API_URL}/api/admin/content/rooms/9/file`, () => { downloads++; return new HttpResponse(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'application/octet-stream' } }); }),
      http.post(`${API_URL}/api/rooms/:id/*`, ({ request }) => { writes.push(request.url); return HttpResponse.json({ success: true }); }));
    const user = userEvent.setup(); mount('/admin/preview/rooms/9?kind=CTF');
    await screen.findByRole('heading', { name: 'Pokój', level: 1 });
    await user.click(screen.getByRole('button', { name: /Odblokuj/ }));
    expect(screen.getByText('Podpowiedź do testu')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText(/flagę/i), 'CTF{preview}');
    await user.click(screen.getByRole('button', { name: /Sprawdź|Wyślij|Zatwierdź/i }));
    expect(await screen.findByText('Tryb podglądu: wynik nie jest zapisywany.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Pobierz Plik/i }));
    await waitFor(() => expect(anchor).toHaveBeenCalled());
    expect(downloads).toBe(1); expect(writes).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Wróć do edycji pokoju' }));
    expect(await screen.findByRole('heading', { name: 'Pokój', level: 1 })).toBeInTheDocument();
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
    await screen.findByRole('button', { name: /Wróć do edycji/ });
    await user.click(screen.getByRole('button', { name: /Wróć do edycji/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/paths/5'));
  });
});

describe('system paths', () => {
  const system = { ...path, id: 7, title: 'Dyżur Zero', description: 'Prawdziwy terminal.', published: true, chapters: [], systemKey: 'ukos' };
  it('lists the system path without deletion and opens it read-only', async () => {
    server.use(
      http.get(`${API_URL}/api/admin/paths`, () => HttpResponse.json([
        { id: 5, title: 'Web', description: '', bannerUrl: null, hasBanner: false, roomsCount: 1, enrolled: false, published: true, systemKey: null },
        { id: 7, title: 'Dyżur Zero', description: 'Prawdziwy terminal.', bannerUrl: null, hasBanner: false, roomsCount: 0, enrolled: false, published: true, systemKey: 'ukos' },
      ])),
      http.get(`${API_URL}/api/admin/paths/7`, () => HttpResponse.json(system)),
    );
    const user = userEvent.setup(); mount('/admin/paths');
    expect(await screen.findByText('Systemowa')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usuń Web' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Usuń Dyżur Zero' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Zobacz Dyżur Zero' }));
    expect(await screen.findByText(/Nie można jej edytować ani usunąć w panelu/)).toBeInTheDocument();
    expect(screen.getByText('Prawdziwy terminal.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Otwórz ścieżkę' })).toHaveAttribute('href', '/learn/ukos');
    expect(screen.queryByRole('form', { name: 'Edytor ścieżki' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Usuń ścieżkę' })).not.toBeInTheDocument();
  });
  it('omits the open action for unknown system paths', async () => {
    server.use(http.get(`${API_URL}/api/admin/paths/7`, () => HttpResponse.json({ ...system, description: '', systemKey: 'inna' })));
    mount('/admin/paths/7');
    expect(await screen.findByText('Bez opisu')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Otwórz ścieżkę' })).not.toBeInTheDocument();
  });
});
