import { setClerkSession } from '../../test/clerk';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
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
const room = { id: 9, title: 'Pokój', description: 'Treść', shortDescription: '', difficulty: 'EASY' as const, category: 'Path', points: 50, solutionsCount: 0,
  requiresVpn: false, roomType: 'PATH' as const, contentRevision: 0, createdAt: '2026-10-10T10:00:00', updatedAt: null };
beforeAll(() => {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  window.matchMedia = ((media: string) => ({ matches: false, media, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
});
beforeEach(() => {
  setClerkSession(createToken('ADMIN'));
  server.use(currentUserHandler('ADMIN'), http.get(`${API_URL}/api/admin/rooms`, () => HttpResponse.json([])), http.get(`${API_URL}/api/admin/paths`, () => HttpResponse.json([])),
    http.get(`${API_URL}/api/admin/paths/5`, () => HttpResponse.json(path)), http.get(`${API_URL}/api/admin/content/rooms/9`, () => HttpResponse.json({ room, tasks: { revision: 0, tasks: [] } })));
});
afterEach(() => vi.restoreAllMocks());
async function chooseType(user: ReturnType<typeof userEvent.setup>, type: 'Teoria' | 'CTF') {
  await user.click(await screen.findByRole('radio', { name: type }));
}
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
      http.get(`${API_URL}/api/admin/rooms`, () => HttpResponse.json([{ ...room, paths: [{ id: 5, title: 'Web', published: true }] }])));
    await user.click(screen.getByRole('button', { name: 'Dodaj pokoje' }));
    expect(await screen.findByText('Dodano pokoje. Gracze zobaczą je po publikacji ścieżki.')).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: 'Nowy pokój w rozdziale 1' })).toBeInTheDocument();
    expect(screen.getByText('Szkic')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zapisz' })).toBeDisabled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('keeps edits when continuing and discards them only when explicitly leaving', async () => {
    const user = userEvent.setup(); const router = mount('/admin/paths/5');
    await user.type(await screen.findByLabelText('Tytuł *'), ' lokalny');
    await user.click(screen.getByRole('link', { name: 'Pokoje' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Kontynuuj edycję' }));
    expect(router.state.location.pathname).toBe('/admin/paths/5');
    expect(screen.getByLabelText('Tytuł *')).toHaveValue('Web lokalny');
    await user.click(screen.getByRole('link', { name: 'Pokoje' }));
    await user.click(screen.getByRole('button', { name: 'Wyjdź bez zapisywania' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/paths/rooms'));
  });
  it('does not navigate on failed save-and-leave, focuses first invalid field and keeps all data', async () => {
    const user = userEvent.setup(); const router = mount('/admin/paths/5');
    const title = await screen.findByLabelText('Tytuł *'); await user.clear(title);
    await user.type(screen.getByLabelText('Nazwa rozdziału 1'), ' lokalny');
    await user.click(screen.getByRole('button', { name: 'Podgląd' }));
    await user.click(screen.getByRole('button', { name: 'Zapisz i przejdź dalej' }));
    expect(await screen.findByText('To pole jest wymagane')).toBeInTheDocument();
    await waitFor(() => expect(title).toHaveFocus());
    expect(router.state.location.pathname).toBe('/admin/paths/5');
    expect(screen.getByLabelText('Nazwa rozdziału 1')).toHaveValue('Wstęp lokalny');
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
  it('saves a new path quietly as a draft, creates the room in its chapter and returns with the room lit up', async () => {
    const user = userEvent.setup(); const router = mount('/admin/paths/new');
    const savePath = vi.spyOn(contentApi, 'savePath').mockResolvedValue({ ...path, title: 'Nowa', chapters: [{ id: 11, title: 'Rozdział 1', roomIds: [] }] });
    server.use(http.get(`${API_URL}/api/admin/paths/5`, () => HttpResponse.json({ ...path, title: 'Nowa', chapters: [{ id: 11, title: 'Rozdział 1', roomIds: [] }] })));
    await user.type(await screen.findByLabelText('Tytuł *'), 'Nowa');
    await user.click(screen.getByRole('button', { name: 'Nowy pokój w rozdziale 1' }));
    await waitFor(() => expect(router.state.location.search).toBe('?pathId=5&chapterId=11&pathRevision=3'));
    expect(savePath.mock.calls[0][1].published).toBe(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const crumbs = await screen.findByRole('navigation', { name: 'Okruszki' });
    expect(crumbs).toHaveTextContent('Nowa');
    expect(crumbs).toHaveTextContent('Rozdział 1');
    expect(crumbs).toHaveTextContent('Nowy pokój');
    expect(screen.getByRole('link', { name: 'Nowa' })).toHaveAttribute('href', '/admin/paths/5');
    expect(screen.queryByText(/Pokój zostanie przypisany/)).not.toBeInTheDocument();
    expect(await screen.findByRole('radio', { name: 'Teoria' })).toBeChecked();
    await chooseType(user, 'CTF');
    for (const label of ['Tytuł *', 'Opis', 'Plik do pobrania', 'Wymaga VPN']) expect(screen.getByLabelText(label)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dodaj zadanie z flagą' }));
    expect(screen.getByLabelText('Flaga')).toHaveAttribute('placeholder', 'HACK{...}');
    await user.type(screen.getByLabelText('Tytuł *'), 'Skaner');
    await user.type(screen.getByLabelText('Tytuł zadania *'), 'Flaga');
    const created = { ...room, id: 12, title: 'Skaner', roomType: 'CTF' as const, paths: [{ id: 5, title: 'Nowa', published: false }] };
    const saveRoom = vi.spyOn(contentApi, 'saveRoom').mockResolvedValue({ room: created, tasks: { revision: 1, tasks: [] }, pathId: 5, paths: created.paths });
    server.use(http.get(`${API_URL}/api/admin/paths/5`, () => HttpResponse.json({ ...path, title: 'Nowa', contentRevision: 4, chapters: [{ id: 11, title: 'Rozdział 1', roomIds: [12] }] })),
      http.get(`${API_URL}/api/admin/rooms`, () => HttpResponse.json([created])));
    await user.click(screen.getByRole('button', { name: 'Zapisz' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/paths/5'));
    expect(saveRoom.mock.calls[0][1]).toMatchObject({ pathId: 5, chapterId: 11, pathRevision: 3, roomType: 'CTF' });
    const row = (await screen.findByText('Skaner')).closest('li')!;
    expect(row).toHaveClass('bg-primary/15');
    expect(screen.queryByText(/Zapisano/)).not.toBeInTheDocument();
    await waitFor(() => expect(row).not.toHaveClass('bg-primary/15'), { timeout: 3500 });
  });
  it('asks for the path title before it can save the path for a new room', async () => {
    const user = userEvent.setup(); const router = mount('/admin/paths/new');
    const save = vi.spyOn(contentApi, 'savePath');
    await user.click(await screen.findByRole('button', { name: 'Nowy pokój w rozdziale 1' }));
    expect(await screen.findByText('To pole jest wymagane')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Tytuł *')).toHaveFocus());
    expect(save).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe('/admin/paths/new');
  });
  it('carries edits of a published path with the new room, so an empty new chapter can be published with it', async () => {
    const live = { ...path, description: 'Opis', published: true, chapters: [{ id: 11, title: 'Wstęp', roomIds: [9] }] };
    server.use(http.get(`${API_URL}/api/admin/paths/5`, () => HttpResponse.json(live)),
      http.get(`${API_URL}/api/admin/rooms`, () => HttpResponse.json([{ ...room, paths: [{ id: 5, title: 'Web', published: true }] }])));
    const user = userEvent.setup(); const router = mount('/admin/paths/5');
    const savePath = vi.spyOn(contentApi, 'savePath');
    await screen.findByLabelText('Tytuł *');
    await user.click(screen.getByRole('button', { name: 'Dodaj rozdział' }));
    await user.click(screen.getByRole('button', { name: 'Nowy pokój w rozdziale 2' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/paths/rooms/new'));
    expect(savePath).not.toHaveBeenCalled();
    expect(await screen.findByRole('navigation', { name: 'Okruszki' })).toHaveTextContent('Rozdział 2');
    expect(screen.queryByLabelText('Tytuł ścieżki *')).not.toBeInTheDocument();
    // The path edits travel only with this form, so leaving it untouched still asks first.
    await user.click(screen.getByRole('link', { name: 'Web' }));
    expect(await screen.findByRole('dialog', { name: 'Niezapisane zmiany' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Kontynuuj edycję' }));
    expect(router.state.location.pathname).toBe('/admin/paths/rooms/new');
    await user.type(screen.getByLabelText('Tytuł *'), 'Zachowany pokój');
    await user.click(screen.getByRole('button', { name: 'Zapisz' }));
    // The path is published, so the new room needs its description and a task as well.
    await waitFor(() => expect(screen.getByLabelText('Opis *')).toHaveFocus());
    expect(screen.getByLabelText('Tytuł *')).toHaveValue('Zachowany pokój');
    const saveRoom = vi.spyOn(contentApi, 'saveRoom').mockResolvedValue({ room: { ...room, id: 13 }, tasks: { revision: 1, tasks: [] }, pathId: 5, paths: [] });
    await user.type(screen.getByLabelText('Opis *'), 'Opis pokoju');
    await user.click(screen.getByRole('button', { name: 'Dodaj zadanie' }));
    await user.type(screen.getByLabelText('Tytuł zadania *'), 'Czytaj'); await user.type(screen.getByLabelText('Treść *'), 'Tekst');
    await user.click(screen.getByRole('button', { name: 'Zapisz' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/paths/5'));
    expect(saveRoom.mock.calls[0][1]).toMatchObject({ pathId: 5, chapterIndex: 1, parentDraft: { published: true, chapters: [{ id: 11, roomIds: [9] }, { id: null, title: 'Rozdział 2', roomIds: [] }] } });
  });
  it('still asks a published path for rooms in its other empty chapters before carrying it with a new room', async () => {
    server.use(http.get(`${API_URL}/api/admin/paths/5`, () => HttpResponse.json({ ...path, description: 'Opis', published: true, chapters: [{ id: 11, title: 'Wstęp', roomIds: [9] }] })));
    const user = userEvent.setup(); const router = mount('/admin/paths/5');
    await screen.findByLabelText('Tytuł *');
    await user.click(screen.getByRole('button', { name: 'Dodaj rozdział' }));
    await user.click(screen.getByRole('button', { name: 'Dodaj rozdział' }));
    await user.click(screen.getByRole('button', { name: 'Nowy pokój w rozdziale 3' }));
    expect(await screen.findByText('Dodaj pokój do rozdziału przed publikacją')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin/paths/5');
  });
  it('opens the new room form straight away for an unchanged published path', async () => {
    server.use(http.get(`${API_URL}/api/admin/paths/5`, () => HttpResponse.json({ ...path, description: 'Opis', published: true, chapters: [{ id: 11, title: 'Wstęp', roomIds: [9] }] })));
    const user = userEvent.setup(); const router = mount('/admin/paths/5');
    const savePath = vi.spyOn(contentApi, 'savePath');
    await user.click(await screen.findByRole('button', { name: 'Nowy pokój w rozdziale 1' }));
    await waitFor(() => expect(router.state.location.search).toBe('?pathId=5&chapterId=11&pathRevision=3'));
    expect(savePath).not.toHaveBeenCalled();
  });
  it('shows pasted overflow without truncating content and preserves task and hint edits after server failure', async () => {
    const user = userEvent.setup(); mount('/admin/paths/rooms/9');
    const title = await screen.findByLabelText('Tytuł *');
    fireEvent.change(title, { target: { value: 'x'.repeat(256) } });
    expect(title).toHaveValue('x'.repeat(256)); expect(screen.getByText('256/255')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zapisz' })); expect(await screen.findByText('Maksymalnie 255 znaków')).toBeInTheDocument();
    await user.clear(title); await user.type(title, 'Pokój');
    await user.click(screen.getByRole('button', { name: 'Dodaj zadanie' }));
    await user.type(screen.getByLabelText('Tytuł zadania *'), 'Pierwsze');
    await user.click(screen.getByRole('button', { name: 'Dodaj podpowiedź' }));
    await user.type(screen.getByLabelText('Podpowiedź 1 *'), 'Podpowiedź lokalna');
    vi.spyOn(contentApi, 'saveRoom').mockRejectedValue(new contentApi.ContentError('Awaria zapisu'));
    await user.click(screen.getByRole('button', { name: 'Zapisz' }));
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
    await user.click(screen.getByRole('button', { name: 'Zapisz' }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls[0][1].unlockMode).toBe('ROOM');
  });
  it('loads the saved unlock mode of an existing path', async () => {
    server.use(http.get(`${API_URL}/api/admin/paths/5`, () => HttpResponse.json({ ...path, unlockMode: 'CHAPTER' })));
    mount('/admin/paths/5');
    expect(await screen.findByLabelText('Tryb odblokowania')).toHaveValue('CHAPTER');
  });
  it('adds an existing room to the chosen chapter and saves its assignment', async () => {
    server.use(http.get(`${API_URL}/api/admin/rooms`, () => HttpResponse.json([{ ...room, paths: [] }])));
    const user = userEvent.setup(); mount('/admin/paths/5');
    const save = vi.spyOn(contentApi, 'savePath').mockResolvedValue(path);
    await screen.findByLabelText('Tytuł *');
    expect(screen.getByRole('button', { name: 'Zapisz' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Dodaj rozdział' }));
    expect(screen.getByRole('button', { name: 'Zapisz' })).toBeEnabled();
    const add = screen.getAllByRole('button', { name: 'Dodaj istniejący' })[1];
    await user.click(add);
    expect(add).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('searchbox', { name: 'Szukaj pokoju do rozdziału 2' })).toHaveFocus();
    expect(screen.getByText('Nieprzypisany')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dodaj Pokój do rozdziału' }));
    expect(screen.getByRole('list', { name: 'Pokoje rozdziału 2' })).toHaveTextContent('Pokój');
    expect(screen.getByText('Wszystkie pokoje są już w tej ścieżce.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zapisz' }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls[0][1].chapters).toEqual([{ id: 11, title: 'Wstęp', roomIds: [] }, { id: null, title: 'Rozdział 2', roomIds: [9] }]);
  });
  it('shows the publication bar with a warning on a published path and moves it back to drafts', async () => {
    server.use(http.get(`${API_URL}/api/admin/paths/5`, () => HttpResponse.json({ ...path, description: 'Opis', published: true, chapters: [{ id: 11, title: 'Wstęp', roomIds: [9] }] })));
    const user = userEvent.setup(); mount('/admin/paths/5');
    const save = vi.spyOn(contentApi, 'savePath').mockResolvedValue({ ...path, description: 'Opis', published: false, chapters: [{ id: 11, title: 'Wstęp', roomIds: [9] }] });
    await screen.findByLabelText('Tytuł *');
    const bar = screen.getByRole('region', { name: 'Stan ścieżki' });
    expect(bar).toHaveTextContent('Opublikowana');
    expect(bar).toHaveTextContent('Edytujesz opublikowaną ścieżkę. Zmiany po zapisie od razu zobaczą użytkownicy.');
    expect(bar).toHaveClass('bg-amber-50/95');
    await user.click(screen.getByRole('button', { name: 'Przenieś do szkiców' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Przenieść ścieżkę do szkiców?' });
    expect(dialog).toHaveTextContent('Ścieżka i jej rozdziały znikną graczom.');
    expect(save).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('button', { name: 'Przenieś do szkiców' })).toHaveClass('bg-destructive');
    await user.click(within(dialog).getByRole('button', { name: 'Przenieś do szkiców' }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls[0][1].published).toBe(false);
    expect(await screen.findByRole('button', { name: 'Opublikuj' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Stan ścieżki' })).toHaveTextContent('Szkic');
    expect(screen.queryByText(/Edytujesz opublikowaną ścieżkę/)).not.toBeInTheDocument();
  });
  it('publishes a draft path from the bar', async () => {
    server.use(http.get(`${API_URL}/api/admin/paths/5`, () => HttpResponse.json({ ...path, description: 'Opis', chapters: [{ id: 11, title: 'Wstęp', roomIds: [9] }] })));
    const user = userEvent.setup(); mount('/admin/paths/5');
    const save = vi.spyOn(contentApi, 'savePath').mockResolvedValue({ ...path, description: 'Opis', published: true, chapters: [{ id: 11, title: 'Wstęp', roomIds: [9] }] });
    await user.type(await screen.findByLabelText('Tytuł *'), ' 2');
    await user.click(screen.getByRole('button', { name: 'Opublikuj' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Opublikować ścieżkę?' });
    expect(dialog).toHaveTextContent('Gracze od razu zobaczą ścieżkę i wszystkie jej pokoje. Niezapisane zmiany zapiszą się razem z nią.');
    expect(within(dialog).getByRole('button', { name: 'Opublikuj' })).not.toHaveClass('bg-destructive');
    await user.click(within(dialog).getByRole('button', { name: 'Opublikuj' }));
    await waitFor(() => expect(save.mock.calls[0][1]).toMatchObject({ published: true, title: 'Web 2' }));
    expect(await screen.findByText(/Edytujesz opublikowaną ścieżkę/)).toBeInTheDocument();
  });
  it('resets the native upload field after saving so the same file can be selected again', async () => {
    server.use(http.get(`${API_URL}/api/admin/content/rooms/9`, () => HttpResponse.json({ room: { ...room, roomType: 'CTF' }, tasks: { revision: 0, tasks: [] } })));
    const user = userEvent.setup(); mount('/admin/paths/rooms/9'); await screen.findByLabelText('Tytuł *');
    const file = new File(['training'], 'training.bin', { type: 'application/octet-stream' });
    const save = vi.spyOn(contentApi, 'saveRoom').mockResolvedValue({ room: { ...room, roomType: 'CTF', contentRevision: 1 }, tasks: { revision: 0, tasks: [] } });
    await user.upload(screen.getByLabelText('Plik do pobrania'), file);
    await user.click(screen.getByRole('button', { name: 'Zapisz' })); await screen.findByText('Zapisano pokój.');
    expect((screen.getByLabelText('Plik do pobrania') as HTMLInputElement).files).toHaveLength(0);
    await user.upload(screen.getByLabelText('Plik do pobrania'), file);
    await user.click(screen.getByRole('button', { name: 'Zapisz' }));
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

describe('room type in the editor', () => {
  it('switches a theory room to CTF and back without losing its tasks', async () => {
    const tasks = [{ id: 31, title: 'Pytanie', content: 'Treść', question: 'Polecenie?', answer: 'pwd', hints: [] }];
    server.use(http.get(`${API_URL}/api/admin/content/rooms/9`, () => HttpResponse.json({ room, tasks: { revision: 4, tasks } })));
    const save = vi.spyOn(contentApi, 'saveRoom').mockResolvedValue({ room: { ...room, roomType: 'CTF', contentRevision: 1 }, tasks: { revision: 5, tasks } });
    const user = userEvent.setup(); mount('/admin/paths/rooms/9');
    await screen.findByLabelText('Tytuł *');
    expect(screen.queryByLabelText('Plik do pobrania')).toBeNull();
    await user.click(screen.getByRole('radio', { name: 'CTF' }));
    expect(screen.getByLabelText('Trudność *')).toBeInTheDocument();
    expect(screen.getByLabelText('Plik do pobrania')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Pytanie/ }));
    expect(screen.getByLabelText('Pytanie (opcjonalnie)')).toHaveValue('Polecenie?');
    expect(screen.getByLabelText('Flaga')).toHaveValue('pwd');
    await user.click(screen.getByRole('radio', { name: 'Teoria' }));
    expect(screen.getByLabelText('Odpowiedź')).toHaveValue('pwd');
    await user.click(screen.getByRole('radio', { name: 'CTF' }));
    await user.click(screen.getByRole('button', { name: 'Zapisz' }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls[0][1]).toMatchObject({ roomType: 'CTF', points: 50, tasks });
  });

  it('has only one save action and no publication of its own', async () => {
    mount('/admin/paths/rooms/9');
    await screen.findByLabelText('Tytuł *');
    expect(screen.getByRole('button', { name: 'Zapisz' })).toBeInTheDocument();
    for (const name of ['Opublikuj', 'Przenieś do szkiców', 'Zapisz szkic', 'Zapisz zmiany']) expect(screen.queryByRole('button', { name })).toBeNull();
    expect(screen.queryByText(/Status:/)).toBeNull();
    expect(screen.getByLabelText('Opis')).not.toBeRequired();
    expect(screen.queryByText(/Do zapisu wystarczy tytuł/)).not.toBeInTheDocument();
  });

  it('asks for a task and for a flag in every CTF task once players can see the room', async () => {
    const save = vi.spyOn(contentApi, 'saveRoom');
    server.use(http.get(`${API_URL}/api/admin/content/rooms/9`, () => HttpResponse.json({ room: { ...room, roomType: 'CTF' }, tasks: { revision: 0, tasks: [] }, pathId: 5, live: true })));
    const user = userEvent.setup(); mount('/admin/paths/rooms/9');
    await screen.findByLabelText('Tytuł *');
    expect(screen.getByLabelText('Opis *')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zapisz' }));
    expect(await screen.findByText('Dodaj przynajmniej jedno zadanie')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dodaj zadanie z flagą' }));
    await user.type(screen.getByLabelText('Tytuł zadania *'), 'Flaga');
    await user.type(screen.getByLabelText('Treść *'), 'Szukaj');
    await user.click(screen.getByRole('button', { name: 'Zapisz' }));
    expect(await screen.findByText('To pole jest wymagane')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Flaga *')).toHaveFocus());
    expect(save).not.toHaveBeenCalled();
  });

  it('opens a new room with the type from the address', async () => {
    const user = userEvent.setup(); mount('/admin/paths/rooms/new?type=CTF');
    await screen.findByLabelText('Tytuł *');
    expect(screen.getByRole('radio', { name: 'CTF' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'Teoria' }));
    expect(screen.getByLabelText('XP *')).toBeInTheDocument();
  });

  it('gives a new CTF room the CTF category and keeps an edited one', async () => {
    const user = userEvent.setup(); mount('/admin/paths/rooms/new');
    await screen.findByLabelText('Tytuł *');
    await user.click(screen.getByRole('radio', { name: 'CTF' }));
    expect(screen.getByLabelText('Kategoria *')).toHaveValue('Web');
    await user.clear(screen.getByLabelText('Kategoria *'));
    await user.type(screen.getByLabelText('Kategoria *'), 'Crypto');
    await user.click(screen.getByRole('radio', { name: 'Teoria' }));
    await user.click(screen.getByRole('radio', { name: 'CTF' }));
    expect(screen.getByLabelText('Kategoria *')).toHaveValue('Crypto');
  });
});

describe('room title and scoring rules', () => {
  it('shows a duplicate title reported by the backend next to the title field', async () => {
    server.use(http.put(`${API_URL}/api/admin/content/rooms/9`, () => HttpResponse.json({ message: 'Rozdział tego pokoju ma już pokój o tym tytule', fields: { title: 'Rozdział tego pokoju ma już pokój o tym tytule' } }, { status: 409 })));
    const user = userEvent.setup(); mount('/admin/paths/rooms/9');
    const title = await screen.findByLabelText('Tytuł *');
    await user.clear(title); await user.type(title, 'Wstęp');
    await user.click(screen.getByRole('button', { name: 'Zapisz' }));
    expect(await screen.findByText('Rozdział tego pokoju ma już pokój o tym tytule', { selector: '#content-title-error' })).toBeInTheDocument();
    await waitFor(() => expect(title).toHaveFocus());
    expect(title).toHaveValue('Wstęp');
  });
  it('rejects reserved tutorial titles before saving a new room', async () => {
    const save = vi.spyOn(contentApi, 'saveRoom');
    const user = userEvent.setup(); mount('/admin/paths/rooms/new');
    await chooseType(user, 'CTF');
    await user.type(await screen.findByLabelText('Tytuł *'), ' tutorial VPN ');
    await user.click(screen.getByRole('button', { name: 'Zapisz' }));
    expect(await screen.findByText('Tytuły „Tutorial VM” i „Tutorial VPN” są zarezerwowane dla pokoi samouczka')).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });
  it('keeps the title of an existing tutorial room editable', async () => {
    server.use(http.get(`${API_URL}/api/admin/content/rooms/9`, () => HttpResponse.json({ room: { ...room, title: 'Tutorial VM', roomType: 'CTF', category: 'Tutorial' }, tasks: { revision: 0, tasks: [] } })));
    const save = vi.spyOn(contentApi, 'saveRoom').mockResolvedValue({ room: { ...room, title: 'Tutorial VM', roomType: 'CTF', category: 'Tutorial' }, tasks: { revision: 0, tasks: [] } });
    const user = userEvent.setup(); mount('/admin/paths/rooms/9');
    await user.type(await screen.findByLabelText('Opis'), ' nowy');
    await user.click(screen.getByRole('button', { name: 'Zapisz' }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls[0][1].title).toBe('Tutorial VM');
  });
  it('edits a moved CTF room in the rooms tab with points derived from difficulty', async () => {
    server.use(http.get(`${API_URL}/api/admin/content/rooms/9`, () => HttpResponse.json({ room: { ...room, roomType: 'CTF', category: 'Web', points: 50 }, tasks: { revision: 0, tasks: [] } })));
    const user = userEvent.setup(); mount('/admin/paths/rooms/9');
    await screen.findByLabelText('Tytuł *');
    expect(screen.queryByLabelText('XP *')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dodaj zadanie' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Pokoje' })).toHaveAttribute('href', '/admin/paths/rooms');
    await user.selectOptions(screen.getByLabelText('Trudność *'), 'INSANE');
    expect(screen.getByText('200 XP')).toBeInTheDocument();
  });
  it('shows a duplicate room title in a chapter reported by the backend', async () => {
    server.use(http.get(`${API_URL}/api/admin/rooms`, () => HttpResponse.json([{ ...room, paths: [{ id: 5, title: 'Web', published: true }] }])),
      http.get(`${API_URL}/api/admin/paths/5`, () => HttpResponse.json({ ...path, chapters: [{ id: 11, title: 'Wstęp', roomIds: [9] }] })),
      http.put(`${API_URL}/api/admin/content/paths/5`, () => HttpResponse.json({ message: 'Rozdział 1 zawiera już pokój „Pokój”', fields: { 'chapters.0.rooms': 'Rozdział 1 zawiera już pokój „Pokój”' } }, { status: 409 })));
    const user = userEvent.setup(); mount('/admin/paths/5');
    await user.type(await screen.findByLabelText('Nazwa rozdziału 1'), ' lokalny');
    await user.click(screen.getByRole('button', { name: 'Zapisz' }));
    expect(await screen.findAllByText('Rozdział 1 zawiera już pokój „Pokój”')).not.toHaveLength(0);
    expect(screen.getByLabelText('Nazwa rozdziału 1')).toHaveValue('Wstęp lokalny');
  });
});

describe('room shared by many paths', () => {
  const paths = [{ id: 5, title: 'Web Basics', published: true }, { id: 6, title: 'Linux 101', published: true }, { id: 7, title: 'Szkic', published: false }];
  it('warns that edits go live in every published path and lists them when deleting', async () => {
    let deleted = false;
    server.use(http.get(`${API_URL}/api/admin/content/rooms/9`, () => HttpResponse.json({ room, tasks: { revision: 0, tasks: [] }, pathId: 5, paths })),
      http.delete(`${API_URL}/api/admin/rooms/9`, () => { deleted = true; return new HttpResponse(null, { status: 204 }); }));
    const user = userEvent.setup(); const router = mount('/admin/paths/rooms/9');
    expect(await screen.findByText(/Ten pokój jest w 2 opublikowanych ścieżkach: Web Basics, Linux 101\. Zmiany po zapisie są od razu widoczne\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Usuń pokój' }));
    expect(await screen.findByText('Zniknie z 3 ścieżek:', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Web Basics, Linux 101, Szkic')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Usuń pokój' }).at(-1)!);
    await waitFor(() => expect(deleted).toBe(true));
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/paths/5'));
  });
  it('returns to the path editor the room was opened from, or to the rooms tab', async () => {
    server.use(http.get(`${API_URL}/api/admin/content/rooms/9`, () => HttpResponse.json({ room, tasks: { revision: 0, tasks: [] }, pathId: null, paths })));
    mount('/admin/paths/rooms/9', [{ pathname: '/admin/paths/rooms/9', state: { returnPathId: 6 } }]);
    expect(await screen.findByRole('link', { name: '← Wróć do edytora ścieżki' })).toHaveAttribute('href', '/admin/paths/6');
  });
  it('opens a room from the path editor with that path as the way back', async () => {
    server.use(http.get(`${API_URL}/api/admin/paths/5`, () => HttpResponse.json({ ...path, chapters: [{ id: 11, title: 'Wstęp', roomIds: [9] }] })),
      http.get(`${API_URL}/api/admin/rooms`, () => HttpResponse.json([{ ...room, paths }])),
      http.get(`${API_URL}/api/admin/content/rooms/9`, () => HttpResponse.json({ room, tasks: { revision: 0, tasks: [] }, pathId: null, paths })));
    const user = userEvent.setup(); const router = mount('/admin/paths/5');
    const row = (await screen.findByText('Pokój')).closest('li')!;
    expect(row).toHaveTextContent('50 XP');
    expect(row).toHaveTextContent('Też w 2 innych ścieżkach');
    await user.click(screen.getByRole('button', { name: 'Edytuj Pokój' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/paths/rooms/9'));
    expect(await screen.findByRole('navigation', { name: 'Okruszki' })).toHaveTextContent('Wstęp');
    expect(screen.getByRole('link', { name: 'Web' })).toHaveAttribute('href', '/admin/paths/5');
  });
  it('returns to the rooms tab when a shared room was opened from the list', async () => {
    server.use(http.get(`${API_URL}/api/admin/content/rooms/9`, () => HttpResponse.json({ room, tasks: { revision: 0, tasks: [] }, pathId: null, paths })));
    mount('/admin/paths/rooms/9');
    expect(await screen.findByRole('link', { name: '← Pokoje' })).toHaveAttribute('href', '/admin/paths/rooms');
  });
  it('names a single published path and stays quiet for draft-only paths', async () => {
    server.use(http.get(`${API_URL}/api/admin/content/rooms/9`, () => HttpResponse.json({ room, tasks: { revision: 0, tasks: [] }, pathId: 5, paths: paths.slice(0, 1) })));
    mount('/admin/paths/rooms/9');
    expect(await screen.findByText(/Ten pokój jest w 1 opublikowanej ścieżce: Web Basics\./)).toBeInTheDocument();
  });
  it('shows no warning when the room is only in draft paths', async () => {
    server.use(http.get(`${API_URL}/api/admin/content/rooms/9`, () => HttpResponse.json({ room, tasks: { revision: 0, tasks: [] }, pathId: 7, paths: paths.slice(2) })));
    const user = userEvent.setup(); mount('/admin/paths/rooms/9');
    await screen.findByLabelText('Tytuł *');
    expect(screen.queryByText(/opublikowan/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Usuń pokój' }));
    expect(await screen.findByText('Zniknie ze ścieżki', { exact: false })).toBeInTheDocument();
  });
});

describe('administrative preview', () => {
  it('uses the player room view, reveals saved draft hints and never writes player progress', async () => {
    const writes: string[] = [];
    server.use(http.get(`${API_URL}/api/admin/content/rooms/9/preview`, () => HttpResponse.json({ ...room, solved: false, fileName: null,
      tasks: [{ id: 3, title: 'Zadanie', content: '<strong>Treść HTML</strong>', question: null, completed: false, hints: [{ id: 1, order: 0, description: 'Tajna podpowiedź' }] }] })),
      http.post(`${API_URL}/api/rooms/:id/*`, ({ request }) => { writes.push(request.url); return HttpResponse.json({ success: true }); }));
    const user = userEvent.setup(); mount('/admin/preview/rooms/9?kind=PATH');
    expect(await screen.findByRole('heading', { name: 'Pokój', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Treść HTML').tagName).toBe('STRONG');
    expect(screen.queryByText('Tajna podpowiedź')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Podpowiedź \(1\/1\)/ }));
    expect(screen.getByText('Tajna podpowiedź')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Zgłoś błąd' })).toBeNull();
    await user.click(screen.getByRole('button', { name: /Przeczytane|Ukończ zadanie|Oznacz/i }));
    await user.click(screen.getByRole('button', { name: /Ukończ pokój/ }));
    expect(await screen.findByText('Podgląd: postęp i XP nie są zapisywane.')).toBeInTheDocument();
    expect(writes).toEqual([]);
  });
  it('simulates flag and hint actions locally and downloads only from the protected preview endpoint', async () => {
    const writes: string[] = []; let downloads = 0;
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:preview-file' });
    const anchor = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    server.use(http.get(`${API_URL}/api/admin/content/rooms/9`, () => HttpResponse.json({ room: { ...room, roomType: 'CTF' }, tasks: { revision: 0, tasks: [] } })), http.get(`${API_URL}/api/admin/content/rooms/9/preview`, () => HttpResponse.json({ ...room, solved: false, fileName: 'training.bin',
      roomType: 'CTF',
      tasks: [{ id: 5, title: 'Flaga', content: 'Znajdź flagę', question: null, requiresAnswer: true, completed: false, hints: [{ id: 1, order: 0, description: 'Podpowiedź do testu' }] }] })),
      http.get(`${API_URL}/api/admin/content/rooms/9/file`, () => { downloads++; return new HttpResponse(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'application/octet-stream' } }); }),
      http.post(`${API_URL}/api/rooms/:id/*`, ({ request }) => { writes.push(request.url); return HttpResponse.json({ success: true }); }));
    const user = userEvent.setup(); mount('/admin/preview/rooms/9?kind=CTF');
    await screen.findByRole('heading', { name: 'Pokój', level: 1 });
    await user.click(screen.getByRole('button', { name: /^Podpowiedź \(1\/1\)/ }));
    expect(screen.getByText('Podpowiedź do testu')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('HACK{...}'), 'CTF{{preview}');
    await user.click(screen.getByRole('button', { name: 'Sprawdź' }));
    expect(await screen.findByRole('button', { name: 'Poprawne' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Pobierz Plik/i }));
    await waitFor(() => expect(anchor).toHaveBeenCalled());
    expect(downloads).toBe(1); expect(writes).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Wróć do edycji pokoju' }));
    expect(await screen.findByRole('heading', { name: 'Pokój', level: 1 })).toBeInTheDocument();
    expect(await screen.findByLabelText('Trudność *')).toBeInTheDocument();
  });
  it('shows chapters and rooms in order and opens a draft room with a return to the path preview', async () => {
    server.use(http.get(`${API_URL}/api/admin/content/paths/5/preview`, () => HttpResponse.json({ ...path, enrolled: true, rooms: [], chapters: [{ id: 11, title: 'Wstęp', totalRooms: 1, solvedRooms: 0, rooms: [{ ...room, solved: false, locked: false }] }] })),
      http.get(`${API_URL}/api/admin/content/rooms/9/preview`, () => HttpResponse.json({ ...room, solved: false, tasks: [], fileName: null })));
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
