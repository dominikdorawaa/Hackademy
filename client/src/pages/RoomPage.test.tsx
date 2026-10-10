import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import API_URL from '../apiConfig';
import { server } from '../test/mocks/server';
import { createToken } from '../test/fixtures/auth';
import { renderWithAuth } from '../test/renderWithAuth';
import type { RoomDetailDto, RoomTaskDto } from '../types/api';
import RoomPage from './RoomPage';

function mount(tasks: RoomTaskDto[]) {
  const room: RoomDetailDto = {
    id: 7, title: 'HTTP', description: 'Opis', shortDescription: '', difficulty: 'EASY',
    points: 50, solutionsCount: 0, createdAt: '2026-10-01T00:00:00', solved: false,
    requiresVpn: false, hints: [], unlockedHintIds: [], fileName: null, tasks,
  };
  server.use(http.get(`${API_URL}/api/rooms/7`, () => HttpResponse.json(room)));
  localStorage.setItem('token', createToken('USER'));
  renderWithAuth(<Route path="/rooms/:id" element={<RoomPage />} />, '/rooms/7');
}

const completedRoom = { success: true, message: 'Poprawna odpowiedź! Pokój ukończony!', pointsEarned: 50, newBadges: [] };

describe('task room completion', () => {
  it('lets players acknowledge reading tasks without typing an answer', async () => {
    let submitted: unknown;
    server.use(http.post(`${API_URL}/api/rooms/7/tasks/1/solve`, async ({ request }) => {
      submitted = await request.json();
      return HttpResponse.json(completedRoom);
    }));
    mount([{ id: 1, title: 'Lektura', content: 'Przeczytaj', question: null, completed: false }]);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Oznacz jako przeczytane' }));
    expect(submitted).toEqual({ answer: '' });
    expect(await screen.findByText('Wszystkie zadania wykonane! Pokój ukończony.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Przeczytano' })).toBeDisabled();
  });

  it('lets players finish when all remaining tasks were completed before a deletion', async () => {
    let completions = 0;
    server.use(http.post(`${API_URL}/api/rooms/7/tasks/complete`, () => {
      completions++;
      return HttpResponse.json(completedRoom);
    }));
    mount([{ id: 1, title: 'Zadanie A', content: 'Treść', question: 'Pytanie?', completed: true }]);
    await userEvent.click(await screen.findByRole('button', { name: 'Ukończ pokój' }));
    expect(completions).toBe(1);
    expect(await screen.findByText('Wszystkie zadania wykonane! Pokój ukończony.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ukończ pokój' })).not.toBeInTheDocument();
  });

  it('does not offer completion when there is still an unfinished task', async () => {
    mount([{ id: 1, title: 'Zadanie A', content: 'Treść', question: 'Pytanie?', completed: false }]);
    await screen.findByRole('heading', { name: 'HTTP' });
    expect(screen.queryByRole('button', { name: 'Ukończ pokój' })).not.toBeInTheDocument();
  });
});
