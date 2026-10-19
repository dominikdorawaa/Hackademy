import { setClerkSession } from '../../test/clerk';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import API_URL from '../../apiConfig';
import { AuthProvider } from '../../context/AuthContext';
import { ThemeProvider } from '../../context/ThemeContext';
import { server } from '../../test/mocks/server';
import { currentUserHandler } from '../../test/mocks/handlers';
import { createToken } from '../../test/fixtures/auth';
import { AdminAccessRoute } from './adminAccess';
import RoomsPage from './RoomsPage';
import * as contentApi from '../../services/contentApi';
import type { CtfImportResult } from '../../services/contentApi';
import type { RoomAdminSummaryDto, RoomType } from '../../types/api';
import example from '../../data/ctf-import-example.json?raw';

const room: RoomAdminSummaryDto = { id: 81, title: 'Zaimportowany', category: 'Web', difficulty: 'MEDIUM', points: 100, requiresVpn: false, roomType: 'CTF', pathId: null, pathTitle: null, published: false };
beforeAll(() => { globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver; });
beforeEach(() => {
  setClerkSession(createToken('ADMIN'));
  server.use(currentUserHandler('ADMIN'), http.get(`${API_URL}/api/admin/rooms`, () => HttpResponse.json([])));
});
function mount(kind: RoomType = 'CTF') {
  const router = createMemoryRouter([{ element: <ThemeProvider><AuthProvider><Outlet /></AuthProvider></ThemeProvider>, children: [
    { path: '/admin/ctf', element: <AdminAccessRoute><RoomsPage kind={kind} /></AdminAccessRoute> },
    { path: '/', element: <p>Główna</p> },
  ] }], { initialEntries: ['/admin/ctf'] });
  render(<RouterProvider router={router} />); return router;
}
async function open() { const user = userEvent.setup(); const router = mount(); await user.click(await screen.findByRole('button', { name: 'Importuj CTF z JSON' })); return { user, router }; }
function choose(file = new File([example], 'ctf.json', { type: 'application/json' })) { fireEvent.change(screen.getByLabelText('Plik JSON (do 5 MB)'), { target: { files: [file] } }); return file; }

describe('CTF JSON import', () => {
  it('shows the same downloadable and copyable example without a points field', async () => {
    const { user } = await open();
    expect(screen.getByRole('button', { name: 'Importuj jako szkice' })).toBeDisabled();
    await user.click(screen.getByText('Format i przykładowy plik JSON'));
    expect(screen.getByLabelText('Przykładowy JSON')).toHaveValue(example);
    const sample = JSON.parse(example) as { rooms: Record<string, unknown>[] };
    expect(sample.rooms.every(room => !('points' in room) && !('tasks' in room))).toBe(true);
    const link = screen.getByRole('link', { name: 'Pobierz przykład' });
    expect(link).toHaveAttribute('download', 'przyklad-ctf.json');
    expect(decodeURIComponent(link.getAttribute('href')!.split(',')[1])).toBe(example);
    const copy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    await user.click(screen.getByRole('button', { name: 'Kopiuj przykład' })); expect(copy).toHaveBeenCalledWith(example);
    expect(await screen.findByText('Skopiowano przykład.')).toBeInTheDocument();
    copy.mockRejectedValueOnce(new Error('Denied')); await user.click(screen.getByRole('button', { name: 'Kopiuj przykład' }));
    expect(await screen.findByText(/Nie udało się skopiować/)).toBeInTheDocument();
  });
  it('uploads the file, clears search and reloads the CTF list with imported drafts', async () => {
    let imported = false;
    server.use(http.get(`${API_URL}/api/admin/rooms`, () => HttpResponse.json(imported ? [room, { ...room, id: 90, title: 'PATH', roomType: 'PATH' }] : [{ ...room, title: 'Stary pokój' }])));
    const upload = vi.spyOn(contentApi, 'importCtfRooms').mockImplementation(async () => { imported = true; return { count: 1, roomIds: [81] }; });
    const { user, router } = await open(); const file = choose();
    await user.click(screen.getByRole('button', { name: 'Anuluj' }));
    await user.type(screen.getByLabelText('Szukaj pokoju'), 'stary');
    await user.click(screen.getByRole('button', { name: 'Importuj CTF z JSON' })); choose(file);
    await user.click(screen.getByRole('button', { name: 'Importuj jako szkice' }));
    expect(await screen.findByText('Zaimportowano 1 pokój CTF. Materiały zapisano jako szkice.')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Zaimportowany' })).toHaveAttribute('href', '/admin/ctf/81');
    expect(screen.getByLabelText('Szukaj pokoju')).toHaveValue(''); expect(screen.getByText('Szkic')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'PATH' })).not.toBeInTheDocument();
    expect(upload).toHaveBeenCalledWith(file, expect.any(String));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(router.state.location.pathname).toBe('/admin/ctf');
  });
  it('shows all located errors and retains the selected file for retry', async () => {
    const upload = vi.spyOn(contentApi, 'importCtfRooms').mockRejectedValue(new contentApi.ContentError('Błędy', { 'pokój 1: title': 'Duplikat w bazie', 'pokój 2: flag': 'Brak flagi' }));
    const { user } = await open(); const file = choose();
    await user.click(screen.getByRole('button', { name: 'Importuj jako szkice' }));
    expect(await screen.findByText('pokój 1: title: Duplikat w bazie')).toBeInTheDocument(); expect(screen.getByText('pokój 2: flag: Brak flagi')).toBeInTheDocument();
    expect(screen.getByText(file.name)).toBeInTheDocument();
    upload.mockRejectedValueOnce(new Error('Conflict')); await user.click(screen.getByRole('button', { name: 'Importuj jako szkice' }));
    expect(await screen.findByText('Conflict')).toBeInTheDocument();
    upload.mockRejectedValueOnce(null); await user.click(screen.getByRole('button', { name: 'Importuj jako szkice' }));
    expect(await screen.findByText('Nie udało się zaimportować pokoi CTF.')).toBeInTheDocument();
    expect(upload).toHaveBeenCalledTimes(3);
  });
  it('checks file limits locally and resets selection and errors after closing', async () => {
    const upload = vi.spyOn(contentApi, 'importCtfRooms'); const { user } = await open();
    for (const file of [new File([], 'empty.json'), new File(['x'.repeat(5 * 1024 * 1024 + 1)], 'large.json')]) {
      choose(file); await user.click(screen.getByRole('button', { name: 'Importuj jako szkice' }));
      expect(await screen.findByText('Wybierz niepusty plik JSON do 5 MB.')).toBeInTheDocument();
    }
    choose(); expect(screen.queryByRole('alert')).not.toBeInTheDocument(); expect(upload).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Anuluj' })); await user.click(screen.getByRole('button', { name: 'Importuj CTF z JSON' }));
    expect(screen.getByRole('button', { name: 'Importuj jako szkice' })).toBeDisabled(); expect(screen.queryByText('ctf.json')).not.toBeInTheDocument();
  });
  it('prevents duplicate submissions and dismissal until import completes', async () => {
    let finish!: (value: CtfImportResult) => void;
    const upload = vi.spyOn(contentApi, 'importCtfRooms').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const { user } = await open(); choose();
    const form = screen.getByRole('button', { name: 'Importuj jako szkice' }).closest('form')!;
    fireEvent.submit(form); fireEvent.submit(form);
    expect(upload).toHaveBeenCalledOnce(); expect(screen.getByRole('button', { name: 'Importowanie…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Zmień plik' })).toBeDisabled(); expect(screen.getByRole('button', { name: 'Anuluj' })).toBeDisabled();
    await user.keyboard('{Escape}'); expect(screen.getByRole('dialog')).toBeInTheDocument();
    finish({ count: 4, roomIds: [1, 2, 3, 4] }); await screen.findByText('Zaimportowano 4 pokoje CTF. Materiały zapisano jako szkice.');
  });
  it('hides CTF import from experts and from the PATH room section', async () => {
    setClerkSession(createToken('EXPERT')); server.use(currentUserHandler('EXPERT')); mount();
    await screen.findByRole('link', { name: 'Nowy pokój' }); expect(screen.queryByRole('button', { name: 'Importuj CTF z JSON' })).not.toBeInTheDocument();
  });
  it('shows no CTF import in the PATH room section', async () => {
    mount('PATH'); await screen.findByRole('link', { name: 'Nowy pokój' }); expect(screen.queryByRole('button', { name: 'Importuj CTF z JSON' })).not.toBeInTheDocument();
  });
  it('keeps imported success visible when reloading the room list fails', async () => {
    const { user } = await open(); choose(); vi.spyOn(contentApi, 'importCtfRooms').mockResolvedValue({ count: 1, roomIds: [81] });
    server.use(http.get(`${API_URL}/api/admin/rooms`, () => HttpResponse.json({ message: 'Lista niedostępna' }, { status: 500 })));
    await user.click(screen.getByRole('button', { name: 'Importuj jako szkice' }));
    expect(await screen.findByText('Zaimportowano 1 pokój CTF. Materiały zapisano jako szkice.')).toBeInTheDocument();
    expect(await screen.findByText('Lista niedostępna')).toBeInTheDocument(); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Importuj CTF z JSON' })).toBeEnabled());
  });
  it('preserves rows on delete failure and removes them after confirmed deletion', async () => {
    server.use(http.get(`${API_URL}/api/admin/rooms`, () => HttpResponse.json([room])),
      http.delete(`${API_URL}/api/admin/rooms/81`, () => HttpResponse.json({ message: 'Usunięcie niedostępne' }, { status: 409 })));
    const user = userEvent.setup(); mount(); await user.click(await screen.findByRole('button', { name: 'Usuń Zaimportowany' }));
    await user.click(screen.getByRole('button', { name: 'Usuń pokój' }));
    expect(await screen.findByText('Usunięcie niedostępne')).toBeInTheDocument(); expect(screen.getByRole('link', { name: 'Zaimportowany' })).toBeInTheDocument();
    server.use(http.delete(`${API_URL}/api/admin/rooms/81`, () => new HttpResponse(null, { status: 204 })));
    await user.click(screen.getByRole('button', { name: 'Usuń Zaimportowany' })); await user.click(screen.getByRole('button', { name: 'Usuń pokój' }));
    expect(await screen.findByText('Pokój „Zaimportowany” został usunięty.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Zaimportowany' })).not.toBeInTheDocument();
  });
});
