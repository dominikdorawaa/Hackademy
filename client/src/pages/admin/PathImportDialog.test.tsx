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
import PathsPage from './PathsPage';
import PathImportDialog from './PathImportDialog';
import type { ExistingImportPath } from './PathImportDialog';
import * as contentApi from '../../services/contentApi';
import type { PathAdminDetailDto } from '../../types/api';
import example from '../../data/path-import-example.json?raw';

const imported: PathAdminDetailDto = { id: 12, title: 'Import', description: 'Opis', bannerUrl: null, hasBanner: false, revision: 0, chapters: [], published: false };
beforeAll(() => {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});
beforeEach(() => {
  setClerkSession(createToken('ADMIN'));
  server.use(currentUserHandler('ADMIN'), http.get(`${API_URL}/api/admin/paths`, () => HttpResponse.json([])));
});
function mount(existing?: ExistingImportPath, onImported?: (path: PathAdminDetailDto) => void) {
  const router = createMemoryRouter([{ element: <ThemeProvider><AuthProvider><Outlet /></AuthProvider></ThemeProvider>, children: [
    { path: '/admin/paths', element: <AdminAccessRoute>{existing ? <PathImportDialog existing={existing} onImported={onImported} /> : <PathsPage />}</AdminAccessRoute> },
    { path: '/admin/paths/12', element: <h1>Edytor importu</h1> },
    { path: '/', element: <h1>Główna</h1> },
  ] }], { initialEntries: ['/admin/paths'] });
  render(<RouterProvider router={router} />);
  return router;
}
async function open() {
  const user = userEvent.setup();
  const router = mount();
  await user.click(await screen.findByRole('button', { name: 'Importuj JSON' }));
  return { user, router };
}
function choose(file = new File([example], 'path.json', { type: 'application/json' })) {
  fireEvent.change(screen.getByLabelText('Plik JSON (do 5 MB)'), { target: { files: [file] } });
  return file;
}

describe('learning path import', () => {
  it('makes file selection visible and shows the name and size without losing it on picker cancellation', async () => {
    const { user } = await open();
    const input = screen.getByLabelText('Plik JSON (do 5 MB)');
    const click = vi.spyOn(input, 'click');
    await user.click(screen.getByRole('button', { name: 'Wybierz plik JSON' }));
    expect(click).toHaveBeenCalledOnce();
    const file = choose();
    expect(screen.getByText('path.json')).toBeInTheDocument();
    expect(screen.getByText(/Wybrany plik/)).toHaveTextContent('KB');
    expect(input).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Zmień plik' }));
    fireEvent.change(input, { target: { files: [] } });
    expect(screen.getByText(file.name)).toBeInTheDocument();
    const replacement = new File(['{}'], 'replacement.json'); choose(replacement);
    expect(screen.getByText(replacement.name)).toBeInTheDocument();
    expect(screen.queryByText(file.name)).not.toBeInTheDocument();
  });
  it('shows a readable downloadable example and copies it', async () => {
    const { user } = await open();
    expect(screen.getByRole('button', { name: 'Importuj jako szkic' })).toBeDisabled();
    await user.click(screen.getByText('Format i przykładowy plik JSON'));
    expect(screen.getByLabelText('Przykładowy JSON')).toHaveValue(example.replace(/\r\n/g, '\n'));
    const link = screen.getByRole('link', { name: 'Pobierz przykład' });
    expect(link).toHaveAttribute('download', 'przyklad-sciezki.json');
    expect(decodeURIComponent(link.getAttribute('href')!.split(',')[1])).toBe(example);
    const copy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    await user.click(screen.getByRole('button', { name: 'Kopiuj przykład' }));
    expect(copy).toHaveBeenCalledWith(example);
    expect(await screen.findByText('Skopiowano przykład.')).toBeInTheDocument();
    copy.mockRejectedValueOnce(new Error('Clipboard denied'));
    await user.click(screen.getByRole('button', { name: 'Kopiuj przykład' }));
    expect(await screen.findByText(/Nie udało się skopiować/)).toBeInTheDocument();
  });
  it('uploads the selected file and opens the imported draft editor', async () => {
    const upload = vi.spyOn(contentApi, 'importPath').mockResolvedValue(imported);
    const { user, router } = await open();
    const file = choose();
    await user.click(screen.getByRole('button', { name: 'Importuj jako szkic' }));
    expect(await screen.findByRole('heading', { name: 'Edytor importu' })).toBeInTheDocument();
    expect(upload).toHaveBeenCalledWith(file, expect.any(String));
    expect(router.state.location.pathname).toBe('/admin/paths/12');
    expect(router.state.location.state.flash).toContain('jako szkic');
  });
  it('shows every located error and keeps the selected file for retry', async () => {
    const upload = vi.spyOn(contentApi, 'importPath').mockRejectedValue(new contentApi.ContentError('Błędy', {
      'rozdział 2, pokój 3: flag': 'To pole jest wymagane', 'rozdział 3: title': 'Maksymalnie 120 znaków',
    }));
    const { user } = await open(); const file = choose();
    await user.click(screen.getByRole('button', { name: 'Importuj jako szkic' }));
    expect(await screen.findByText('rozdział 2, pokój 3: flag: To pole jest wymagane')).toBeInTheDocument();
    expect(screen.getByText('rozdział 3: title: Maksymalnie 120 znaków')).toBeInTheDocument();
    upload.mockResolvedValueOnce(imported);
    await user.click(screen.getByRole('button', { name: 'Importuj jako szkic' }));
    await screen.findByRole('heading', { name: 'Edytor importu' });
    expect(upload).toHaveBeenLastCalledWith(file, expect.any(String));
  });
  it('rejects empty and oversized files locally and clears errors on another selection', async () => {
    const upload = vi.spyOn(contentApi, 'importPath');
    const { user } = await open();
    for (const file of [new File([], 'empty.json'), new File(['x'.repeat(5 * 1024 * 1024 + 1)], 'big.json')]) {
      choose(file);
      await user.click(screen.getByRole('button', { name: 'Importuj jako szkic' }));
      expect(await screen.findByText('Wybierz niepusty plik JSON do 5 MB.')).toBeInTheDocument();
    }
    choose();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });
  it('handles transport failures and resets the form when closed', async () => {
    const upload = vi.spyOn(contentApi, 'importPath').mockRejectedValue(new Error('Serwer niedostępny'));
    const { user } = await open(); choose();
    await user.click(screen.getByRole('button', { name: 'Importuj jako szkic' }));
    expect(await screen.findByText('Serwer niedostępny')).toBeInTheDocument();
    upload.mockRejectedValueOnce(null);
    await user.click(screen.getByRole('button', { name: 'Importuj jako szkic' }));
    expect(await screen.findByText('Nie udało się zaimportować ścieżki.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Anuluj' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Importuj JSON' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Importuj jako szkic' })).toBeDisabled();
  });
  it('prevents repeated uploads and closing the dialog during import', async () => {
    let finish!: (value: PathAdminDetailDto) => void;
    const upload = vi.spyOn(contentApi, 'importPath').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const { user } = await open(); choose();
    await user.click(screen.getByRole('button', { name: 'Importuj jako szkic' }));
    expect(screen.getByRole('button', { name: 'Importowanie…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Anuluj' })).toBeDisabled();
    expect(screen.getByLabelText('Plik JSON (do 5 MB)')).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(upload).toHaveBeenCalledTimes(1);
    finish(imported);
    await screen.findByRole('heading', { name: 'Edytor importu' });
  });
  it('hides import from experts', async () => {
    setClerkSession(createToken('EXPERT'));
    server.use(currentUserHandler('EXPERT'));
    mount();
    await waitFor(() => expect(screen.getByRole('link', { name: 'Nowa ścieżka' })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Importuj JSON' })).not.toBeInTheDocument();
  });
  it('keeps existing draft rows editable and handles deletion success and failure', async () => {
    const paths = [{ ...imported, roomsCount: 2 }];
    server.use(http.get(`${API_URL}/api/admin/paths`, () => HttpResponse.json(paths)),
      http.delete(`${API_URL}/api/admin/paths/12`, () => HttpResponse.json({ message: 'Nie można usunąć' }, { status: 409 })));
    const user = userEvent.setup(); mount();
    expect(await screen.findByRole('link', { name: 'Edytuj Import' })).toHaveAttribute('href', '/admin/paths/12');
    expect(screen.getByText('Szkic')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Usuń Import' }));
    await user.click(screen.getByRole('button', { name: 'Usuń ścieżkę' }));
    expect(await screen.findByText('Nie można usunąć')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Import' })).toBeInTheDocument();
    server.use(http.delete(`${API_URL}/api/admin/paths/12`, () => new HttpResponse(null, { status: 204 })));
    await user.click(screen.getByRole('button', { name: 'Usuń Import' }));
    await user.click(screen.getByRole('button', { name: 'Usuń ścieżkę' }));
    expect(await screen.findByText(/Ścieżka „Import” została usunięta/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Import' })).not.toBeInTheDocument();
  });
  it('still offers import when loading the existing path list fails', async () => {
    server.use(http.get(`${API_URL}/api/admin/paths`, () => HttpResponse.json({ message: 'Nie udało się pobrać listy' }, { status: 500 })));
    const user = userEvent.setup(); mount();
    expect(await screen.findByText('Nie udało się pobrać listy')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Importuj JSON' }));
    expect(screen.getByRole('dialog', { name: 'Import ścieżki z JSON' })).toBeInTheDocument();
  });
});

describe('import into an existing path', () => {
  const existing: ExistingImportPath = { id: 12, title: 'Zapisana ścieżka', contentRevision: 7, chaptersRevision: 4,
    chapters: [{ id: 21, title: 'Pierwszy', roomIds: [1] }, { id: 22, title: 'Drugi', roomIds: [] }] };
  it('uses a rooms-only example and sends the selected chapter with both path versions', async () => {
    const upload = vi.spyOn(contentApi, 'importPathRooms').mockResolvedValue(imported);
    const complete = vi.fn(); const user = userEvent.setup(); const router = mount(existing, complete);
    await user.click(await screen.findByRole('button', { name: 'Importuj pokoje z JSON' }));
    expect(screen.getByText('Ścieżka: Zapisana ścieżka')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Dodaj do rozdziału'), '22');
    await user.click(screen.getByText('Format i przykładowy plik JSON'));
    const sample = (screen.getByLabelText('Przykładowy JSON') as HTMLTextAreaElement).value;
    expect(JSON.parse(sample)).toEqual({ rooms: JSON.parse(example).chapters[0].rooms });
    expect(screen.getByRole('link', { name: 'Pobierz przykład' })).toHaveAttribute('download', 'przyklad-pokoi.json');
    const copy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    await user.click(screen.getByRole('button', { name: 'Kopiuj przykład' })); expect(copy).toHaveBeenCalledWith(sample);
    const file = choose(); await user.click(screen.getByRole('button', { name: 'Dodaj pokoje jako szkice' }));
    await waitFor(() => expect(complete).toHaveBeenCalledWith(imported));
    expect(upload).toHaveBeenCalledWith(12, { chapterId: 22, contentRevision: 7, chaptersRevision: 4 }, file, expect.any(String));
    expect(router.state.location.pathname).toBe('/admin/paths');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('preserves file and chapter selection after a stale-version conflict', async () => {
    const upload = vi.spyOn(contentApi, 'importPathRooms').mockRejectedValue(new contentApi.ContentError('Ścieżka zmieniła się w międzyczasie.'));
    const user = userEvent.setup(); mount(existing);
    await user.click(await screen.findByRole('button', { name: 'Importuj pokoje z JSON' }));
    await user.selectOptions(screen.getByLabelText('Dodaj do rozdziału'), '22'); const file = choose();
    await user.click(screen.getByRole('button', { name: 'Dodaj pokoje jako szkice' }));
    expect(await screen.findByText('Ścieżka zmieniła się w międzyczasie.')).toBeInTheDocument();
    expect(screen.getByLabelText('Dodaj do rozdziału')).toHaveValue('22');
    expect(screen.getByText(file.name)).toBeInTheDocument();
    expect(upload).toHaveBeenCalledOnce();
  });
  it('requires a saved chapter before offering the import', async () => {
    mount({ ...existing, chapters: [{ id: null, title: 'Niezapisany', roomIds: [] }] });
    expect(await screen.findByRole('button', { name: 'Importuj pokoje z JSON' })).toBeDisabled();
  });
});
