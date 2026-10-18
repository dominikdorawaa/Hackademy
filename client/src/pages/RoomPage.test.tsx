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
  it('strips active HTML from legacy task content while retaining formatting and newlines', async () => {
    mount([{
      id: 1, title: 'HTML', question: null, completed: false,
      content: '<p onclick="alert(1)" style="color:red">Wstęp <strong>ważne</strong></p><ul><li>lista</li></ul>linia\nkoniec<img src=x onerror="alert(1)"><script>alert(1)</script><a href="javascript:alert(1)">link</a><svg onload="alert(1)"></svg><iframe srcdoc="bad"></iframe>',
    }]);
    await screen.findByRole('button', { name: 'Oznacz jako przeczytane' });
    const content = document.querySelector('.task-content');
    expect(content).not.toBeNull();
    expect(content?.querySelector('img, script, a, svg, iframe, [onclick], [onerror], [style]')).toBeNull();
    expect(content?.querySelector('strong')).toHaveTextContent('ważne');
    expect(content?.querySelector('ul li')).toHaveTextContent('lista');
    expect(content?.querySelector('br')).not.toBeNull();
    expect(content).toHaveTextContent('link');
  });

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

describe('path unlock modes', () => {
  it('explains why a locked path room cannot be entered', async () => {
    server.use(http.get(`${API_URL}/api/rooms/7`, () => HttpResponse.json({ message: 'Ten pokój jest jeszcze zablokowany. Ukończ poprzednie pokoje ścieżki.' }, { status: 403 })));
    localStorage.setItem('token', createToken('USER'));
    renderWithAuth(<Route path="/rooms/:id" element={<RoomPage />} />, '/rooms/7');
    expect(await screen.findByText('Błąd: Ten pokój jest jeszcze zablokowany. Ukończ poprzednie pokoje ścieżki.')).toBeInTheDocument();
  });
});

function mountCtf(overrides: Partial<RoomDetailDto> = {}) {
  const room: RoomDetailDto = {
    id: 7, title: 'Pierwsza flaga', description: 'Znajdź flagę', shortDescription: 'Rozgrzewka', difficulty: 'EASY',
    points: 50, solutionsCount: 3, createdAt: '2026-10-01T00:00:00', solved: false, requiresVpn: false,
    hints: [{ id: 1, description: 'Zajrzyj do źródła strony' }, { id: 2, description: 'Szukaj komentarza' }],
    unlockedHintIds: [], fileName: null, tasks: [], ...overrides,
  };
  server.use(http.get(`${API_URL}/api/rooms/7`, () => HttpResponse.json(room)));
  localStorage.setItem('token', createToken('USER'));
  renderWithAuth(<Route path="/rooms/:id" element={<RoomPage />} />, '/rooms/7');
}

describe('CTF room', () => {
  it('rejects a wrong flag and celebrates the right one', async () => {
    const user = userEvent.setup();
    server.use(http.post(`${API_URL}/api/rooms/7/solve`, async ({ request }) => {
      const { flag } = await request.json() as { flag: string };
      return flag === 'HA-ok'
        ? HttpResponse.json({ success: true, message: 'Brawo', pointsEarned: 50, newBadges: [] })
        : HttpResponse.json({ success: false, message: 'Niepoprawna flaga' }, { status: 400 });
    }));
    mountCtf();
    const input = await screen.findByPlaceholderText('Wklej flagę tutaj...');
    await user.type(input, 'zla');
    await user.click(screen.getByRole('button', { name: 'Zatwierdź' }));
    expect(await screen.findByText('Niepoprawna flaga')).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, 'HA-ok');
    await user.click(screen.getByRole('button', { name: 'Zatwierdź' }));
    expect(await screen.findByText('Misja zakończona sukcesem!')).toBeInTheDocument();
    expect(document.querySelector('.success-flag .pixel-sprite')).toBeInTheDocument();
    expect(screen.getByText('+50')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Kontynuuj' }));
    expect(screen.queryByText('Misja zakończona sukcesem!')).not.toBeInTheDocument();
    expect(screen.getByText('Rozwiązania:')).toHaveTextContent('Rozwiązania: 4');
  });

  it('reports a network error while sending a flag', async () => {
    const user = userEvent.setup();
    server.use(http.post(`${API_URL}/api/rooms/7/solve`, () => HttpResponse.error()));
    mountCtf();
    await user.type(await screen.findByPlaceholderText('Wklej flagę tutaj...'), 'x');
    await user.click(screen.getByRole('button', { name: 'Zatwierdź' }));
    expect(await screen.findByText('Błąd sieci')).toBeInTheDocument();
  });

  it('unlocks hints in order after confirming the point cost', async () => {
    const user = userEvent.setup();
    let unlocks = 0;
    server.use(http.post(`${API_URL}/api/rooms/7/hints/1/unlock`, () => { unlocks++; return HttpResponse.json({ message: 'ok' }); }));
    mountCtf();
    expect(await screen.findByText('Punkty do zdobycia:')).toHaveTextContent('50');
    expect(screen.getByRole('button', { name: 'Zablokowane (odblokuj poprzednią)' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Odblokuj podpowiedź (-12.5 pkt)' }));
    expect(screen.getByText('Czy na pewno chcesz odblokować tę podpowiedź? To odejmie 12.5 punktów.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Anuluj' }));
    expect(unlocks).toBe(0);
    await user.click(screen.getByRole('button', { name: 'Odblokuj podpowiedź (-12.5 pkt)' }));
    await user.click(screen.getByRole('button', { name: 'Tak, odblokuj' }));
    expect(await screen.findByText('Zajrzyj do źródła strony')).toBeInTheDocument();
    expect(unlocks).toBe(1);
    expect(screen.getByText('Punkty do zdobycia:')).toHaveTextContent('38');
    expect(screen.getByRole('button', { name: 'Odblokuj podpowiedź (-12.5 pkt)' })).toBeEnabled();
  });

  it('shows a failed hint unlock', async () => {
    const user = userEvent.setup();
    server.use(http.post(`${API_URL}/api/rooms/7/hints/1/unlock`, () => HttpResponse.json({ message: 'x' }, { status: 500 })));
    mountCtf();
    await user.click(await screen.findByRole('button', { name: 'Odblokuj podpowiedź (-12.5 pkt)' }));
    await user.click(screen.getByRole('button', { name: 'Tak, odblokuj' }));
    expect(await screen.findByText('Failed to unlock hint')).toBeInTheDocument();
    expect(screen.queryByText('Zajrzyj do źródła strony')).not.toBeInTheDocument();
  });

  it('offers a free training run of a solved room with previously unlocked hints', async () => {
    const user = userEvent.setup();
    mountCtf({ solved: true, unlockedHintIds: [1] });
    expect(await screen.findByText('Gratulacje!')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Wklej flagę tutaj...')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Rozwiąż ponownie (Trening)' }));
    expect(screen.getByPlaceholderText('Wklej flagę tutaj...')).toBeInTheDocument();
    expect(screen.getByText('Zajrzyj do źródła strony')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Odblokuj (Trening)' })).toBeEnabled();
    expect(screen.queryByText('Punkty do zdobycia:')).not.toBeInTheDocument();
  });
});
