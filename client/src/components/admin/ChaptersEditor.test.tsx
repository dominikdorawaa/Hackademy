import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import API_URL from '../../apiConfig';
import { server } from '../../test/mocks/server';
import { createToken } from '../../test/fixtures/auth';
import { renderWithAuth } from '../../test/renderWithAuth';
import type { ChapterRequest, PathAdminDetailDto, RoomAdminSummaryDto } from '../../types/api';
import ChaptersEditor from './ChaptersEditor';

const detail: PathAdminDetailDto = {
  id: 5,
  title: 'Web',
  description: 'Opis',
  bannerUrl: null,
  hasBanner: false,
  chapters: [{ id: 11, title: 'Rozdział 1', roomIds: [1, 2] }],
};

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

const rooms = [
  room(1, 'HTTP', { pathId: 5, pathTitle: 'Web' }),
  room(2, 'Cookies', { pathId: 5, pathTitle: 'Web' }),
  room(3, 'SQL'),
  room(4, 'Obcy', { pathId: 9, pathTitle: 'Linux' }),
  room(5, 'Flaga CTF', { roomType: 'CTF' }),
];

function mount(options: { canDelete?: boolean; links?: boolean; onSaved?: (next: PathAdminDetailDto) => void } = {}) {
  localStorage.setItem('token', createToken('ADMIN'));
  return renderWithAuth(
    <Route
      path="/editor"
      element={
        <ChaptersEditor
          pathId={5}
          chapters={detail.chapters}
          rooms={rooms}
          canDeleteChapters={options.canDelete ?? true}
          onSaved={options.onSaved ?? (() => undefined)}
          roomHref={options.links ? (id) => `/rooms/${id}` : undefined}
          newRoomHref={options.links ? '/rooms/new' : undefined}
        />
      }
    />,
    '/editor',
  );
}

function handleSave(respond: (chapters: ChapterRequest[]) => Response) {
  server.use(http.put(`${API_URL}/api/admin/paths/5/chapters`, async ({ request }) => {
    const body = await request.json() as { chapters: ChapterRequest[] };
    return respond(body.chapters);
  }));
}

describe('chapters editor', () => {
  it('blocks edits and discard while a save is pending', async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => { finish = resolve; });
    server.use(http.put(`${API_URL}/api/admin/paths/5/chapters`, async () => {
      await pending;
      return HttpResponse.json(detail);
    }));
    mount();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Dodaj rozdział' }));
    await user.click(screen.getByRole('button', { name: 'Zapisz rozdziały' }));
    try {
      expect(screen.getByLabelText('Nazwa rozdziału 1')).toBeDisabled();
      for (const name of ['Dodaj rozdział', 'Odrzuć zmiany', 'Przesuń Cookies w górę', 'Usuń rozdział 1', 'Dodaj SQL do rozdziału']) {
        expect(screen.getByRole('button', { name })).toBeDisabled();
      }
      for (const select of screen.getAllByRole('combobox')) expect(select).toBeDisabled();
      await user.type(screen.getByLabelText('Nazwa rozdziału 1'), 'utracona edycja');
      expect(screen.getByLabelText('Nazwa rozdziału 1')).toHaveValue('Rozdział 1');
    } finally {
      finish();
    }
    expect(await screen.findByText('Zapisano rozdziały.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nazwa rozdziału 1')).toBeEnabled();
  });

  it('adds a chapter, moves rooms and saves the whole structure', async () => {
    let saved: ChapterRequest[] = [];
    let reported: PathAdminDetailDto | null = null;
    handleSave((chapters) => {
      saved = chapters;
      return HttpResponse.json({ ...detail, chapters: chapters.map((chapter, index) => ({ ...chapter, id: chapter.id ?? 100 + index })) });
    });
    const user = userEvent.setup();
    mount({ onSaved: (next) => { reported = next; } });

    const pool = within(screen.getByRole('complementary', { name: 'Pula pokoi' }));
    expect(pool.getByText('SQL')).toBeInTheDocument();
    expect(pool.queryByText('Obcy')).toBeNull();
    expect(pool.queryByText('Flaga CTF')).toBeNull();
    expect(screen.getByRole('button', { name: 'Zapisz rozdziały' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Dodaj rozdział' }));
    const second = screen.getByLabelText('Nazwa rozdziału 2');
    await user.clear(second);
    await user.type(second, 'Ataki');
    await user.click(pool.getByRole('button', { name: 'Dodaj SQL do rozdziału' }));
    await user.click(screen.getByRole('button', { name: 'Przesuń Cookies w górę' }));
    await user.click(screen.getByRole('button', { name: 'Wyjmij HTTP z rozdziału' }));
    expect(pool.getByText('HTTP')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Nazwa rozdziału 1'));
    await user.type(screen.getByLabelText('Nazwa rozdziału 1'), 'Podstawy');
    await user.click(screen.getByRole('button', { name: 'Przesuń rozdział 2 w górę' }));
    await user.click(screen.getByRole('button', { name: 'Zapisz rozdziały' }));

    expect(await screen.findByText('Zapisano rozdziały.')).toBeInTheDocument();
    expect(saved).toEqual([
      { id: null, title: 'Ataki', roomIds: [3] },
      { id: 11, title: 'Podstawy', roomIds: [2] },
    ]);
    expect(reported).not.toBeNull();
  });

  it('can undo unsaved changes', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole('button', { name: 'Dodaj rozdział' }));
    expect(screen.getByLabelText('Nazwa rozdziału 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Odrzuć zmiany' }));
    expect(screen.queryByLabelText('Nazwa rozdziału 2')).toBeNull();
    expect(screen.getByRole('button', { name: 'Zapisz rozdziały' })).toBeDisabled();
  });

  it('warns about removed chapters, blocks empty names and shows server errors', async () => {
    handleSave(() => HttpResponse.json({ message: 'Pokój „SQL” należy już do ścieżki „Linux”' }, { status: 400 }));
    const user = userEvent.setup();
    mount();

    await user.click(screen.getByRole('button', { name: 'Dodaj rozdział' }));
    await user.clear(screen.getByLabelText('Nazwa rozdziału 2'));
    await user.click(screen.getByRole('button', { name: 'Zapisz rozdziały' }));
    expect(await screen.findByText('Każdy rozdział musi mieć nazwę.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nazwa rozdziału 2')).toHaveAttribute('aria-invalid', 'true');

    await user.type(screen.getByLabelText('Nazwa rozdziału 2'), 'Nowy');
    await user.click(screen.getByRole('button', { name: 'Usuń rozdział 1' }));
    expect(screen.getByText(/zniknie 1 rozdział/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zapisz rozdziały' }));
    expect(await screen.findByText('Pokój „SQL” należy już do ścieżki „Linux”')).toBeInTheDocument();
  });

  it('hides chapter deletion when the user may not delete', () => {
    mount({ canDelete: false });
    expect(screen.queryByRole('button', { name: 'Usuń rozdział 1' })).toBeNull();
  });

  it('links rooms only when routes are provided', () => {
    const view = mount();
    expect(screen.queryByRole('link', { name: 'HTTP' })).toBeNull();
    view.unmount();
    mount({ links: true });
    expect(screen.getByRole('link', { name: 'HTTP' })).toHaveAttribute('href', '/rooms/1');
  });
});
