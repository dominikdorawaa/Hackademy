import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ContentChapters, ContentTasks, placeRoom, stepRoom } from './ContentStructure';
import type { ChapterRequest, RoomAdminSummaryDto, RoomTaskRequest } from '../../types/api';

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});
afterEach(() => vi.restoreAllMocks());
const room = (id: number, title: string, pathId: number | null = 5): RoomAdminSummaryDto => ({ id, title, roomType: 'PATH', paths: pathId == null ? [] : [{ id: pathId, title: `Ścieżka ${pathId}`, published: true }],
  requiresVpn: id === 9, difficulty: 'EASY', points: 50, category: 'Path' });
function Chapters({ create, edit, highlight = null }: { create: (index: number) => void; edit: (id: number, chapter: number) => void; highlight?: number | null }) {
  const [chapters, setChapters] = useState<ChapterRequest[]>([{ id: 1, title: 'Wstęp', roomIds: [9, 10] }, { id: 2, title: 'Dalej', roomIds: [] }]);
  return <form><ContentChapters chapters={chapters} rooms={[room(9, 'VPN'), room(10, 'HTTP'), room(11, 'Wolny', null), room(12, 'Obca ścieżka', 6)]} pathId={5} errors={{}} onChange={setChapters} onCreateRoom={create} onRoom={edit} canDelete highlightRoomId={highlight} />
    <output data-testid="chapters-state">{JSON.stringify(chapters)}</output></form>;
}
function Tasks() {
  const [tasks, setTasks] = useState<RoomTaskRequest[]>([{ id: 1, title: 'Lektura', content: 'Treść', question: null, answer: null }, { id: 2, title: 'Quiz', content: 'Pytanie', question: 'Q?', answer: 'A' }]);
  return <form><ContentTasks tasks={tasks} kind="PATH" errors={{}} ready onChange={setTasks} /><output data-testid="tasks-state">{JSON.stringify(tasks)}</output></form>;
}
function CtfTasks({ ready = true }: { ready?: boolean }) {
  const [tasks, setTasks] = useState<RoomTaskRequest[]>([{ id: 1, title: 'Flaga', content: 'Szukaj', question: null, answer: 'HACK{a}' }, { id: 2, title: 'Z teorii', content: 'Treść', question: 'Stare pytanie?', answer: 'x' }]);
  return <form><ContentTasks tasks={tasks} kind="CTF" errors={{}} ready={ready} onChange={setTasks} /><output data-testid="tasks-state">{JSON.stringify(tasks)}</output></form>;
}
function state(name: string) { return JSON.parse(screen.getByTestId(`${name}-state`).textContent ?? '[]'); }

describe('content structure editing', () => {
  it('shows each chapter as a card of rooms with type, difficulty, XP, edit and unpin', async () => {
    const create = vi.fn(), edit = vi.fn(); const user = userEvent.setup(); render(<Chapters create={create} edit={edit} />);
    const first = within(screen.getByRole('list', { name: 'Pokoje rozdziału 1' }));
    const vpn = first.getByText('VPN', { selector: 'p' }).closest('li')!;
    expect(within(vpn).getByRole('img', { name: 'Teoria' })).toBeInTheDocument();
    expect(vpn).toHaveTextContent('50 XP');
    expect(vpn).toHaveTextContent('1.1');
    expect(first.getByText('HTTP').closest('li')).toHaveTextContent('1.2');
    expect(vpn).not.toHaveTextContent('Łatwy');
    expect(within(screen.getByRole('list', { name: 'Pokoje rozdziału 2' })).getByText('Ten rozdział nie ma jeszcze pokoi.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edytuj VPN' })); expect(edit).toHaveBeenCalledWith(9, 0);
    await user.click(screen.getByRole('button', { name: 'Odepnij HTTP od tej ścieżki' })); expect(state('chapters')[0].roomIds).toEqual([9]);
    await user.click(screen.getByRole('button', { name: 'Nowy pokój w rozdziale 2' })); expect(create).toHaveBeenCalledWith(1);
    await user.click(screen.getByRole('button', { name: 'Przesuń rozdział 2 w górę' })); expect(state('chapters').map((c: ChapterRequest) => c.id)).toEqual([2, 1]);
    await user.click(screen.getByRole('button', { name: 'Usuń rozdział 1' })); expect(state('chapters').map((c: ChapterRequest) => c.id)).toEqual([1]);
    await user.click(screen.getByRole('button', { name: 'Dodaj rozdział' }));
    await user.clear(screen.getByLabelText('Nazwa rozdziału 2')); await user.type(screen.getByLabelText('Nazwa rozdziału 2'), 'Nowy');
    expect(state('chapters')[1]).toMatchObject({ id: null, title: 'Nowy' });
  });
  it('shows CTF difficulty, VPN and the other paths of a room', () => {
    render(<form><ContentChapters chapters={[{ id: 1, title: 'Wstęp', roomIds: [3] }]} pathId={5} errors={{ 'chapters.0.title': 'Za długo' }} onChange={vi.fn()} onCreateRoom={vi.fn()} onRoom={vi.fn()} canDelete={false}
      rooms={[{ ...room(3, 'Skan', 6), roomType: 'CTF', difficulty: 'HARD', points: 200, requiresVpn: true }]} /></form>);
    const row = screen.getByText('Skan').closest('li')!;
    expect(within(row).getByRole('img', { name: 'CTF' })).toBeInTheDocument();
    expect(within(row).getByText('Trudny')).toHaveClass('text-[#c62828]');
    expect(row).toHaveTextContent('200 XP');
    expect(row).toHaveTextContent('VPN');
    expect(within(row).getByText('Też w 1 innej ścieżce')).toHaveAttribute('title', 'Ścieżka 6');
    expect(screen.getByText('Za długo')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Usuń rozdział 1' })).not.toBeInTheDocument();
  });
  it('adds existing rooms per chapter from a search of every room outside this path', async () => {
    const user = userEvent.setup(); render(<Chapters create={vi.fn()} edit={vi.fn()} />);
    expect(screen.queryByText(/Pula pokoi/)).toBeNull();
    const toggle = screen.getAllByRole('button', { name: 'Dodaj istniejący' })[1];
    await user.click(toggle);
    const picker = within(screen.getByRole('list', { name: 'Pokoje do dodania w rozdziale 2' }));
    expect(picker.getByText('Obca ścieżka')).toBeInTheDocument();
    expect(picker.getByText('W 1 innej ścieżce')).toHaveAttribute('title', 'Ścieżka 6');
    expect(picker.getByText('Nieprzypisany')).toBeInTheDocument();
    expect(picker.queryByText('VPN')).toBeNull();
    expect(screen.queryByText(/Opublikowany|Szkic/)).toBeNull();
    await user.type(screen.getByRole('searchbox', { name: 'Szukaj pokoju do rozdziału 2' }), 'OBCA');
    expect(within(screen.getByRole('list', { name: 'Pokoje do dodania w rozdziale 2' })).getAllByRole('listitem')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Dodaj Obca ścieżka do rozdziału' }));
    expect(state('chapters')[1].roomIds).toEqual([12]);
    expect(screen.getByText('Brak pasujących pokoi.')).toBeInTheDocument();
    await user.clear(screen.getByRole('searchbox', { name: 'Szukaj pokoju do rozdziału 2' }));
    await user.click(screen.getByRole('button', { name: 'Dodaj Wolny do rozdziału' }));
    expect(screen.getByText('Wszystkie pokoje są już w tej ścieżce.')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(toggle).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Odepnij HTTP od tej ścieżki' }));
    await user.click(screen.getAllByRole('button', { name: 'Dodaj istniejący' })[0]);
    expect(within(screen.getByRole('list', { name: 'Pokoje do dodania w rozdziale 1' })).getByText('HTTP')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Dodaj istniejący' })[0]);
    expect(screen.queryByRole('searchbox')).toBeNull();
  });
  it('lists rooms to add twenty at a time and searches all of them', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 45 }, (_, i) => room(100 + i, `Pokój ${String(i + 1).padStart(2, '0')}`, null));
    render(<form><ContentChapters chapters={[{ id: 1, title: 'Wstęp', roomIds: [] }]} rooms={many} pathId={5} errors={{}} onChange={vi.fn()} onCreateRoom={vi.fn()} onRoom={vi.fn()} canDelete /></form>);
    await user.click(screen.getByRole('button', { name: 'Dodaj istniejący' }));
    const list = () => within(screen.getByRole('list', { name: 'Pokoje do dodania w rozdziale 1' }));
    expect(list().getAllByRole('listitem')).toHaveLength(20);
    await user.click(screen.getByRole('button', { name: 'Pokaż więcej (25)' }));
    expect(list().getAllByRole('listitem')).toHaveLength(40);
    await user.click(screen.getByRole('button', { name: 'Pokaż więcej (5)' }));
    expect(list().getAllByRole('listitem')).toHaveLength(45);
    expect(screen.queryByRole('button', { name: /Pokaż więcej/ })).toBeNull();
    await user.type(screen.getByRole('searchbox'), 'Pokój 4');
    expect(list().getAllByRole('listitem')).toHaveLength(6);
  });
  it('keeps the open picker on its chapter when chapters swap places', async () => {
    const user = userEvent.setup(); render(<Chapters create={vi.fn()} edit={vi.fn()} />);
    await user.click(screen.getAllByRole('button', { name: 'Dodaj istniejący' })[1]);
    await user.click(screen.getByRole('button', { name: 'Przesuń rozdział 2 w górę' }));
    expect(screen.getByRole('searchbox', { name: 'Szukaj pokoju do rozdziału 1' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dodaj Wolny do rozdziału' }));
    expect(state('chapters').map((c: ChapterRequest) => [c.id, c.roomIds])).toEqual([[2, [11]], [1, [9, 10]]]);
    await user.click(screen.getByRole('button', { name: 'Przesuń rozdział 2 w górę' }));
    expect(screen.getByRole('searchbox', { name: 'Szukaj pokoju do rozdziału 2' })).toBeInTheDocument();
  });
  it('keeps the open picker on its chapter when an earlier chapter is deleted', async () => {
    const user = userEvent.setup(); render(<Chapters create={vi.fn()} edit={vi.fn()} />);
    await user.click(screen.getAllByRole('button', { name: 'Dodaj istniejący' })[1]);
    await user.click(screen.getByRole('button', { name: 'Usuń rozdział 1' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Usunąć rozdział 1?' });
    expect(dialog).toHaveTextContent('Rozdział „Wstęp” zniknie ze ścieżki razem z 2 pokoje po zapisie. Same pokoje zostaną w puli.');
    await user.click(within(dialog).getByRole('button', { name: 'Anuluj' }));
    expect(state('chapters')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Usuń rozdział 1' }));
    await user.click(await screen.findByRole('button', { name: 'Usuń rozdział' }));
    expect(screen.getByRole('searchbox', { name: 'Szukaj pokoju do rozdziału 1' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Usuń rozdział 1' }));
    expect(screen.queryByRole('searchbox')).toBeNull();
  });
  it('moves rooms with the keyboard, also across chapters, and keeps the grip focused', async () => {
    const user = userEvent.setup(); render(<Chapters create={vi.fn()} edit={vi.fn()} />);
    screen.getByRole('button', { name: 'Przesuń VPN' }).focus();
    await user.keyboard('{ArrowDown}'); expect(state('chapters')[0].roomIds).toEqual([10, 9]);
    expect(screen.getByText('VPN: rozdział 1, pozycja 2.')).toBeInTheDocument();
    await user.keyboard('{ArrowDown}'); expect(state('chapters').map((c: ChapterRequest) => c.roomIds)).toEqual([[10], [9]]);
    expect(screen.getByRole('button', { name: 'Przesuń VPN' })).toHaveFocus();
    await user.keyboard('{ArrowDown}'); expect(state('chapters')[1].roomIds).toEqual([9]);
    await user.keyboard('{ArrowUp}'); expect(state('chapters').map((c: ChapterRequest) => c.roomIds)).toEqual([[10, 9], []]);
    await user.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}'); expect(state('chapters')[0].roomIds).toEqual([9, 10]);
    await user.keyboard('a'); expect(state('chapters')[0].roomIds).toEqual([9, 10]);
  });
  it('drags a room by its grip to another place or chapter', () => {
    render(<Chapters create={vi.fn()} edit={vi.fn()} />);
    const box = (top: number, height: number) => ({ top, bottom: top + height, height, left: 0, right: 100, width: 100, x: 0, y: top, toJSON() {} }) as DOMRect;
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const label = this.getAttribute('aria-label'); const id = this.getAttribute('data-room-id');
      if (label === 'Pokoje rozdziału 1') return box(0, 100);
      if (label === 'Pokoje rozdziału 2') return box(200, 50);
      if (id === '9') return box(0, 50);
      if (id === '10') return box(50, 50);
      return box(0, 0);
    });
    const grip = screen.getByRole('button', { name: 'Przesuń VPN' });
    fireEvent.pointerDown(grip, { button: 2, clientY: 25 });
    fireEvent.pointerMove(grip, { clientY: 220 });
    expect(screen.getByText('Ten rozdział nie ma jeszcze pokoi.')).toBeInTheDocument();
    fireEvent.pointerDown(grip, { button: 0, clientY: 25, pointerId: 1 });
    expect(grip.closest('li')).toHaveClass('opacity-40');
    const ghost = document.body.querySelector<HTMLElement>(':scope > div.fixed')!;
    expect(ghost).toHaveTextContent('VPN');
    expect(ghost.style.top).toBe('0px');
    fireEvent.pointerMove(grip, { clientY: 60 });
    expect(ghost.style.top).toBe('35px');
    expect(screen.getByText('Upuść tutaj.')).toBeInTheDocument();
    fireEvent.pointerMove(grip, { clientY: 30 });
    fireEvent.pointerMove(grip, { clientY: 30 });
    fireEvent.pointerMove(grip, { clientY: 400 });
    expect(screen.getByRole('list', { name: 'Pokoje rozdziału 2' }).querySelector('[aria-hidden="true"].h-0')).not.toBeNull();
    fireEvent.pointerUp(grip);
    expect(state('chapters').map((c: ChapterRequest) => c.roomIds)).toEqual([[10], [9]]);
    const http = screen.getByRole('button', { name: 'Przesuń HTTP' });
    fireEvent.pointerDown(http, { button: 0, clientY: 75 });
    expect(http).toHaveFocus();
    fireEvent.pointerMove(http, { clientY: 225 });
    screen.getByLabelText('Nazwa rozdziału 1').focus();
    fireEvent.keyDown(screen.getByLabelText('Nazwa rozdziału 1'), { key: 'Escape' });
    expect(screen.queryByText('Upuść tutaj.')).toBeNull();
    fireEvent.pointerUp(http);
    expect(state('chapters').map((c: ChapterRequest) => c.roomIds)).toEqual([[10], [9]]);
    fireEvent.pointerDown(http, { button: 0, clientY: 25 });
    fireEvent.pointerMove(http, { clientY: 10 });
    fireEvent.pointerUp(http);
    expect(state('chapters').map((c: ChapterRequest) => c.roomIds)).toEqual([[10], [9]]);
    fireEvent.pointerDown(http, { button: 0, clientY: 25 });
    fireEvent.pointerCancel(http);
    expect(screen.queryByText('Upuść tutaj.')).toBeNull();
  });
  it('lights up a room that has just arrived', () => {
    render(<Chapters create={vi.fn()} edit={vi.fn()} highlight={10} />);
    expect(screen.getByText('HTTP').closest('li')).toHaveClass('bg-primary/15');
    expect(screen.getByText('VPN', { selector: 'p' }).closest('li')).not.toHaveClass('bg-primary/15');
  });
  it('places and steps rooms by slots counted without the moved room', () => {
    const chapters: ChapterRequest[] = [{ id: 1, title: 'A', roomIds: [1, 2, 3] }, { id: 2, title: 'B' } as ChapterRequest];
    expect(placeRoom(chapters, 1, { chapter: 0, index: 2 })[0].roomIds).toEqual([2, 3, 1]);
    expect(placeRoom(chapters, 2, { chapter: 1, index: 0 }).map(c => c.roomIds)).toEqual([[1, 3], [2]]);
    expect(stepRoom(chapters, { chapter: 0, index: 0 }, -1)).toBeNull();
    expect(stepRoom(chapters, { chapter: 1, index: 0 }, -1)).toEqual({ chapter: 0, index: 3 });
    expect(stepRoom(chapters, { chapter: 1, index: 0 }, 1)).toBeNull();
  });
  it('keeps all task fields and saved identities when expanding, editing, ordering and deleting', async () => {
    const user = userEvent.setup(); render(<Tasks />);
    await user.click(screen.getByRole('button', { name: /Lektura/ }));
    const reading = within(screen.getByRole('button', { name: /Lektura/ }).closest('li')!);
    await user.type(reading.getByLabelText('Treść *'), ' zmieniona'); expect(state('tasks')[0].content).toBe('Treść zmieniona');
    await user.click(screen.getByRole('button', { name: 'Dodaj zadanie' }));
    const added = within(screen.getByRole('button', { name: /Zadanie bez tytułu/ }).closest('li')!);
    await user.type(added.getByLabelText('Tytuł zadania *'), 'Nowe'); await user.type(added.getByLabelText('Treść *'), 'Treść');
    await user.type(added.getByLabelText('Pytanie'), 'Q?'); await user.type(added.getByLabelText('Odpowiedź *'), 'A');
    await user.click(screen.getByRole('button', { name: 'Przesuń zadanie 3 w górę' })); expect(state('tasks').map((t: RoomTaskRequest) => t.id)).toEqual([1, null, 2]);
    await user.click(screen.getByRole('button', { name: 'Przesuń zadanie 2 w dół' })); expect(state('tasks')[2]).toMatchObject({ title: 'Nowe', question: 'Q?', answer: 'A' });
    await user.click(screen.getByRole('button', { name: 'Usuń zadanie 1' })); expect(state('tasks').map((t: RoomTaskRequest) => t.id)).toEqual([2, null]);
    await user.click(screen.getByRole('button', { name: /Quiz/ })); await user.click(screen.getByRole('button', { name: /Quiz/ }));
    expect(state('tasks')[0]).toMatchObject({ id: 2, question: 'Q?', answer: 'A' });
  });
  it('edits CTF tasks with a flag field and keeps a question carried over from theory', async () => {
    const user = userEvent.setup(); render(<CtfTasks />);
    expect(screen.getAllByText('Z flagą')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: /^Flaga/ }));
    const flag = within(screen.getByRole('button', { name: /^Flaga/ }).closest('li')!);
    expect(flag.queryByLabelText(/Pytanie/)).toBeNull();
    const field = flag.getByLabelText('Flaga *');
    expect(field).toHaveAttribute('placeholder', 'HACK{...}');
    expect(field).toHaveClass('font-mono');
    await user.clear(field);
    expect(screen.getByText('Bez flagi')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Z teorii/ }));
    const carried = within(screen.getByRole('button', { name: /Z teorii/ }).closest('li')!);
    expect(carried.getByLabelText('Pytanie (opcjonalnie)')).toHaveValue('Stare pytanie?');
    await user.click(screen.getByRole('button', { name: 'Dodaj zadanie z flagą' }));
    expect(state('tasks')).toHaveLength(3);
    expect(state('tasks')[1]).toMatchObject({ id: 2, question: 'Stare pytanie?', answer: 'x' });
  });
  it('does not require a flag in a CTF draft', async () => {
    const user = userEvent.setup(); render(<CtfTasks ready={false} />);
    await user.click(screen.getByRole('button', { name: /^Flaga/ }));
    expect(screen.getByLabelText('Flaga')).toBeInTheDocument();
  });
});
