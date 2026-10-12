import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ContentChapters, ContentTasks } from './ContentStructure';
import type { ChapterRequest, RoomAdminSummaryDto, RoomTaskRequest } from '../../types/api';

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});
const room = (id: number, title: string, pathId: number | null = 5): RoomAdminSummaryDto => ({ id, title, roomType: 'PATH', pathId, pathTitle: pathId == null ? null : 'Ścieżka',
  requiresVpn: id === 9, difficulty: 'EASY', points: 50, category: 'Path', published: id !== 11 });
function Chapters({ create, edit }: { create: (index: number) => void; edit: (id: number) => void }) {
  const [chapters, setChapters] = useState<ChapterRequest[]>([{ id: 1, title: 'Wstęp', roomIds: [9, 10] }, { id: 2, title: 'Dalej', roomIds: [] }]);
  return <form><ContentChapters chapters={chapters} rooms={[room(9, 'VPN'), room(10, 'HTTP'), room(11, 'Wolny', null), room(12, 'Obca ścieżka', 6)]} pathId={5} errors={{}} onChange={setChapters} onCreateRoom={create} onRoom={edit} canDelete />
    <output data-testid="chapters-state">{JSON.stringify(chapters)}</output></form>;
}
function Tasks() {
  const [tasks, setTasks] = useState<RoomTaskRequest[]>([{ id: 1, title: 'Lektura', content: 'Treść', question: null, answer: null }, { id: 2, title: 'Quiz', content: 'Pytanie', question: 'Q?', answer: 'A' }]);
  return <form><ContentTasks tasks={tasks} errors={{}} published onChange={setTasks} /><output data-testid="tasks-state">{JSON.stringify(tasks)}</output></form>;
}
function state(name: string) { return JSON.parse(screen.getByTestId(`${name}-state`).textContent ?? '[]'); }

describe('content structure editing', () => {
  it('preserves chapter and room identities while ordering, moving, removing and adding from the pool', async () => {
    const create = vi.fn(), edit = vi.fn(); const user = userEvent.setup(); render(<Chapters create={create} edit={edit} />);
    expect(screen.queryByText('Obca ścieżka')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Przesuń rozdział 2 w górę' })); expect(state('chapters').map((c: ChapterRequest) => c.id)).toEqual([2, 1]);
    await user.click(screen.getByRole('button', { name: 'Przesuń rozdział 1 w dół' }));
    await user.click(screen.getByRole('button', { name: 'Przesuń pokój 9 w dół' })); expect(state('chapters')[0].roomIds).toEqual([10, 9]);
    await user.click(screen.getByRole('button', { name: 'Przesuń pokój 9 w górę' }));
    await user.click(screen.getByRole('button', { name: 'VPN' })); expect(edit).toHaveBeenCalledWith(9);
    await user.click(screen.getByRole('combobox', { name: 'Przenieś pokój 9' }));
    await user.click(await screen.findByRole('option', { name: '2. Dalej' })); expect(state('chapters')[1].roomIds).toEqual([9]);
    await user.click(screen.getByRole('button', { name: 'Wyjmij HTTP z rozdziału' })); expect(state('chapters')[0].roomIds).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Utwórz pokój w rozdziale 2' })); expect(create).toHaveBeenCalledWith(1);
  });
  it('filters the side pool and keeps the selected chapter attached to added rooms', async () => {
    const user = userEvent.setup(); render(<Chapters create={vi.fn()} edit={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Wybierz pokój z puli →' }));
    await user.type(screen.getByRole('textbox', { name: 'Szukaj w puli' }), 'zz'); expect(screen.getByText('Brak pasujących pokoi.')).toBeInTheDocument();
    await user.clear(screen.getByRole('textbox', { name: 'Szukaj w puli' }));
    await user.click(screen.getByRole('combobox', { name: 'Dodawaj do rozdziału' })); await user.click(await screen.findByRole('option', { name: '2. Dalej' }));
    await user.click(screen.getByRole('button', { name: 'Dodaj Wolny do rozdziału' })); expect(state('chapters')[1].roomIds).toEqual([11]);
    await user.click(screen.getByRole('button', { name: 'Usuń rozdział 1' })); expect(state('chapters').map((c: ChapterRequest) => c.id)).toEqual([2]);
    await user.click(screen.getByRole('button', { name: 'Dodaj rozdział' }));
    await user.clear(screen.getByLabelText('Nazwa rozdziału 2 *')); await user.type(screen.getByLabelText('Nazwa rozdziału 2 *'), 'Nowy');
    expect(state('chapters')[1]).toMatchObject({ id: null, title: 'Nowy' });
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
});
