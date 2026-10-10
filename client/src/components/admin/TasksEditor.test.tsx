import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import API_URL from '../../apiConfig';
import { server } from '../../test/mocks/server';
import { createToken } from '../../test/fixtures/auth';
import { renderWithAuth } from '../../test/renderWithAuth';
import type { RoomTaskAdminDto, RoomTaskRequest } from '../../types/api';
import TasksEditor from './TasksEditor';

const tasks: RoomTaskAdminDto[] = [
  { id: 1, title: 'Wstęp', content: 'Czytaj', question: null, answer: null },
  { id: 2, title: 'Metody', content: 'GET i POST', question: 'Metoda formularza?', answer: 'POST' },
];

function mount(respond: (body: RoomTaskRequest[]) => Response, initial: RoomTaskAdminDto[] = tasks) {
  localStorage.setItem('token', createToken('EXPERT'));
  server.use(
    http.get(`${API_URL}/api/admin/rooms/7/tasks`, () => HttpResponse.json(initial)),
    http.put(`${API_URL}/api/admin/rooms/7/tasks`, async ({ request }) => {
      const body = await request.json() as { tasks: RoomTaskRequest[] };
      return respond(body.tasks);
    }),
  );
  return renderWithAuth(<Route path="/room" element={<TasksEditor roomId={7} />} />, '/room');
}

describe('tasks editor', () => {
  it('adds, edits, reorders and deletes tasks in one save', async () => {
    let saved: RoomTaskRequest[] = [];
    mount((body) => {
      saved = body;
      return HttpResponse.json(body.map((task, index) => ({ ...task, id: task.id ?? 50 + index })));
    });
    const user = userEvent.setup();

    expect(await screen.findByRole('button', { name: /Metody/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zapisz zadania' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Dodaj zadanie' }));
    await user.type(screen.getByLabelText('Tytuł zadania'), 'Kody');
    await user.type(screen.getByLabelText('Treść'), 'Kod 404');
    await user.type(screen.getByLabelText('Pytanie'), 'Kod sukcesu?');
    await user.click(screen.getByRole('button', { name: 'Zapisz zadania' }));
    expect(await screen.findByText('Pytanie wymaga odpowiedzi.')).toBeInTheDocument();
    expect(screen.getByText('Popraw zaznaczone zadania przed zapisaniem.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Odpowiedź'), ' 200 ');
    await user.click(screen.getByRole('button', { name: 'Przesuń zadanie 3 w górę' }));
    await user.click(screen.getByRole('button', { name: 'Usuń zadanie 1' }));
    expect(screen.getByText(/zniknie 1 zadanie/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Metody/ }));
    const title = screen.getByDisplayValue('Metody');
    await user.clear(title);
    await user.type(title, 'Metody HTTP');
    await user.click(screen.getByRole('button', { name: 'Zapisz zadania' }));

    expect(await screen.findByText('Zapisano zadania.')).toBeInTheDocument();
    expect(saved).toEqual([
      { id: null, title: 'Kody', content: 'Kod 404', question: 'Kod sukcesu?', answer: '200' },
      { id: 2, title: 'Metody HTTP', content: 'GET i POST', question: 'Metoda formularza?', answer: 'POST' },
    ]);
    expect(screen.getByRole('button', { name: 'Zapisz zadania' })).toBeDisabled();
  });

  it('requires a question for an answer and can discard changes', async () => {
    mount(() => HttpResponse.json([]));
    const user = userEvent.setup();

    await screen.findByRole('button', { name: /Wstęp/ });
    await user.click(screen.getByRole('button', { name: /Wstęp/ }));
    await user.type(screen.getByLabelText('Odpowiedź'), 'x');
    await user.click(screen.getByRole('button', { name: 'Zapisz zadania' }));
    expect(await screen.findByText('Odpowiedź wymaga pytania.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Odrzuć zmiany' }));
    expect(screen.queryByText('Odpowiedź wymaga pytania.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Zapisz zadania' })).toBeDisabled();
  });

  it('shows validation errors returned by the server', async () => {
    mount(() => HttpResponse.json({ message: 'Validation failed', 'tasks[0].title': 'Tytuł zadania jest wymagany' }, { status: 400 }));
    const user = userEvent.setup();

    await screen.findByRole('button', { name: /Metody/ });
    await user.click(screen.getByRole('button', { name: 'Przesuń zadanie 2 w górę' }));
    await user.click(screen.getByRole('button', { name: 'Zapisz zadania' }));
    expect(await screen.findByText('Tytuł zadania jest wymagany')).toBeInTheDocument();
  });

  it('explains an empty room', async () => {
    mount(() => HttpResponse.json([]), []);
    expect(await screen.findByText('Pokój nie ma zadań. Gracz rozwiązuje go wtedy samą flagą.')).toBeInTheDocument();
  });
});
