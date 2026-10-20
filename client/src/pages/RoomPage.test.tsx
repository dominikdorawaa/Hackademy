import { setClerkSession } from '../test/clerk';
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
  setClerkSession(createToken('USER'));
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
    await screen.findByRole('heading', { name: '01. Zadanie A' });
    expect(screen.queryByRole('button', { name: 'Ukończ pokój' })).not.toBeInTheDocument();
  });
});

describe('path unlock modes', () => {
  it('explains why a locked path room cannot be entered', async () => {
    server.use(http.get(`${API_URL}/api/rooms/7`, () => HttpResponse.json({ message: 'Ten pokój jest jeszcze zablokowany. Ukończ poprzednie pokoje ścieżki.' }, { status: 403 })));
    setClerkSession(createToken('USER'));
    renderWithAuth(<Route path="/rooms/:id" element={<RoomPage />} />, '/rooms/7');
    expect(await screen.findByText('Błąd: Ten pokój jest jeszcze zablokowany. Ukończ poprzednie pokoje ścieżki.')).toBeInTheDocument();
  });
});

describe('return navigation', () => {
  const sharedRoom = { id: 7, title: 'HTTP', difficulty: 'EASY', points: 50, solved: false, locked: false, requiresVpn: false };
  const path = (id: number, title: string, rooms: unknown[]) => ({
    id, title, description: '', bannerUrl: null, hasBanner: false, enrolled: true, rooms: [],
    chapters: [{ id: id * 10, title: 'Rozdział', totalRooms: rooms.length, solvedRooms: 0, rooms }],
  });

  function mountAt(url: string, ...overrides: Parameters<typeof server.use>) {
    server.use(
      http.get(`${API_URL}/api/paths/1`, () => HttpResponse.json(path(1, 'Web', [sharedRoom]))),
      http.get(`${API_URL}/api/paths/2`, () => HttpResponse.json(path(2, 'Sieci', [sharedRoom]))),
      http.get(`${API_URL}/api/paths/3`, () => HttpResponse.json(path(3, 'Inna', [{ ...sharedRoom, id: 8 }]))),
      http.get(`${API_URL}/api/paths/404`, () => HttpResponse.json({ message: 'Nie znaleziono' }, { status: 404 })),
    );
    server.use(...overrides);
    return mountCtf({}, url);
  }

  it.each([[1, 'Web'], [2, 'Sieci']])('returns a shared room to path %i it was opened from', async (pathId, title) => {
    mountAt(`/rooms/7?pathId=${pathId}`);
    const back = await screen.findByRole('button', { name: `Wróć do ścieżki: ${title}` });
    await userEvent.click(back);
    expect(screen.getByTestId('location')).toHaveTextContent(`/learn/paths/${pathId}:PUSH`);
  });

  it('keeps the path context after a refresh and after closing the completion modal', async () => {
    const user = userEvent.setup();
    server.use(http.post(`${API_URL}/api/rooms/7/solve`, () => HttpResponse.json({ success: true, message: 'Brawo', pointsEarned: 50, newBadges: [] })));
    mountAt('/rooms/7?pathId=2').unmount();
    mountAt('/rooms/7?pathId=2');
    expect(await screen.findByRole('button', { name: 'Wróć do ścieżki: Sieci' })).toBeInTheDocument();
    await user.type(await screen.findByPlaceholderText('Wklej flagę tutaj...'), 'HA-ok');
    await user.click(screen.getByRole('button', { name: 'Zatwierdź' }));
    await user.click(await screen.findByRole('button', { name: 'Kontynuuj' }));
    expect(await screen.findByRole('button', { name: 'Wróć do ścieżki: Sieci' })).toBeInTheDocument();
  });

  it('falls back to learning for a direct link without context', async () => {
    mountAt('/rooms/7');
    await userEvent.click(await screen.findByRole('button', { name: 'Wróć do nauki' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/learn:PUSH');
  });

  it('returns to the dashboard when the room was opened there', async () => {
    mountAt('/rooms/7?from=dashboard');
    await userEvent.click(await screen.findByRole('button', { name: 'Wróć do dashboardu' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/dashboard:PUSH');
  });

  it.each([['404', 'a removed path'], ['3', 'a path without this room'], ['abc', 'a malformed path id']])('ignores %s (%s) and returns to learning', async (pathId) => {
    mountAt(`/rooms/7?pathId=${pathId}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Wróć do nauki' }));
    expect(screen.queryByRole('button', { name: /Wróć do ścieżki/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/learn:PUSH');
  });

  it('does not send the player anywhere until the path context is checked', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    mountAt('/rooms/7?pathId=2', http.get(`${API_URL}/api/paths/2`, async () => { await gate; return HttpResponse.json(path(2, 'Sieci', [sharedRoom])); }));
    const pending = await screen.findByRole('button', { name: 'Powrót' });
    expect(pending).toBeDisabled();
    release();
    expect(await screen.findByRole('button', { name: 'Wróć do ścieżki: Sieci' })).toBeEnabled();
  });
});

function mountCtf(overrides: Partial<RoomDetailDto> = {}, url = '/rooms/7') {
  const room: RoomDetailDto = {
    id: 7, title: 'Pierwsza flaga', description: 'Znajdź flagę', shortDescription: 'Rozgrzewka', difficulty: 'EASY',
    points: 50, solutionsCount: 3, createdAt: '2026-10-01T00:00:00', solved: false, requiresVpn: false,
    hints: [{ id: 1, description: 'Zajrzyj do źródła strony' }, { id: 2, description: 'Szukaj komentarza' }],
    unlockedHintIds: [], fileName: null, tasks: [], ...overrides,
  };
  server.use(http.get(`${API_URL}/api/rooms/7`, () => HttpResponse.json(room)));
  setClerkSession(createToken('USER'));
  return renderWithAuth(<Route path="/rooms/:id" element={<RoomPage />} />, url);
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

describe('task room reader', () => {
  it('shows one task per page and opens the next page after a correct answer', async () => {
    const user = userEvent.setup();
    let answer: unknown;
    server.use(http.post(`${API_URL}/api/rooms/7/tasks/1/solve`, async ({ request }) => {
      answer = await request.json();
      return HttpResponse.json({ success: true, message: 'Poprawna odpowiedź!' });
    }));
    mount([
      { id: 1, title: 'Pierwsze', content: '<p>Treść A</p>', question: 'Ile?', completed: false },
      { id: 2, title: 'Drugie', content: 'Treść B', question: null, completed: false },
    ]);
    expect(await screen.findByRole('heading', { name: '01. Pierwsze' })).toBeInTheDocument();
    expect(screen.getByText('Opis')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wstecz' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Dalej' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Lista zadań' }));
    expect(screen.getByRole('button', { name: /Drugie/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Lista zadań' }));
    await user.type(screen.getByLabelText('Ile?'), '42');
    await user.click(screen.getByRole('button', { name: 'Sprawdź' }));
    expect(answer).toEqual({ answer: '42' });
    expect(await screen.findByText('Zadanie zaliczone')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Postęp pokoju' })).toHaveAttribute('aria-valuenow', '1');
    await user.click(screen.getByRole('button', { name: 'Dalej' }));
    expect(screen.getByRole('heading', { name: '02. Drugie' })).toBeInTheDocument();
    expect(screen.queryByText('Opis')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zakończ' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Lista zadań' }));
    await user.click(screen.getByRole('button', { name: 'Pierwsze, ukończone' }));
    expect(screen.getByRole('heading', { name: '01. Pierwsze' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Poprawne' })).toBeDisabled();
  });

  it('reports a wrong answer and keeps the next page closed', async () => {
    const user = userEvent.setup();
    server.use(http.post(`${API_URL}/api/rooms/7/tasks/1/solve`, () => HttpResponse.json({ success: false, message: 'Niepoprawna odpowiedź' }, { status: 400 })));
    mount([
      { id: 1, title: 'Pierwsze', content: 'A', question: 'Ile?', completed: false },
      { id: 2, title: 'Drugie', content: 'B', question: 'Co?', completed: false },
    ]);
    await user.type(await screen.findByLabelText('Ile?'), 'zle');
    await user.click(screen.getByRole('button', { name: 'Sprawdź' }));
    expect(await screen.findByText('Niepoprawna odpowiedź')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dalej' })).toBeDisabled();
  });

  it('opens the first unfinished task and leaves a finished room for the path list', async () => {
    mount([
      { id: 1, title: 'Pierwsze', content: 'A', question: 'Ile?', completed: true },
      { id: 2, title: 'Drugie', content: 'B', question: 'Co?', completed: true },
    ]);
    expect(await screen.findByRole('heading', { name: '01. Pierwsze' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Dalej' }));
    expect(screen.getByRole('button', { name: 'Zakończ' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ukończ pokój' })).toBeEnabled();
  });
});

describe('next room in a path', () => {
  const path = {
    id: 1, title: 'Linux', description: '', bannerUrl: null, hasBanner: false, enrolled: true, rooms: [],
    chapters: [{ id: 10, title: 'Start', totalRooms: 2, solvedRooms: 1, rooms: [{ id: 7, title: 'HTTP' }, { id: 8, title: 'DNS' }] }],
  };

  function mountSolved(tasks: RoomTaskDto[], url: string) {
    const room: RoomDetailDto = {
      id: 7, title: 'HTTP', description: 'Opis', shortDescription: '', difficulty: 'EASY',
      points: 50, solutionsCount: 2, createdAt: '2026-10-01T00:00:00', solved: true,
      requiresVpn: false, hints: [], unlockedHintIds: [], fileName: null, tasks,
    };
    server.use(
      http.get(`${API_URL}/api/rooms/7`, () => HttpResponse.json(room)),
      http.get(`${API_URL}/api/paths/1`, () => HttpResponse.json(path)),
    );
    setClerkSession(createToken('USER'));
    renderWithAuth(<Route path="/rooms/:id" element={<RoomPage />} />, url);
  }

  it('sends a solved flag room to the next room of the path', async () => {
    mountSolved([], '/rooms/7?pathId=1');
    await userEvent.click(await screen.findByRole('button', { name: 'Następny pokój' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/rooms/8:PUSH');
  });

  it('sends a solved task room from its last task to the next room of the path', async () => {
    mountSolved([{ id: 1, title: 'Jedyne', content: 'A', question: null, completed: true }], '/rooms/7?pathId=1');
    expect(await screen.findByText('Pokój ukończony')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Następny pokój' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/rooms/8:PUSH');
  });

  it('returns a solved task room without a path to learning', async () => {
    mountSolved([{ id: 1, title: 'Jedyne', content: 'A', question: null, completed: true }], '/rooms/7');
    await userEvent.click(await screen.findByRole('button', { name: 'Zakończ' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/learn:PUSH');
  });
});
