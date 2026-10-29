import { setClerkSession } from '../test/clerk';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, useNavigate } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockRoomViewport } from '../test/roomViewport';
import API_URL from '../apiConfig';
import { server } from '../test/mocks/server';
import { createToken } from '../test/fixtures/auth';
import { renderWithAuth } from '../test/renderWithAuth';
import type { RoomDetailDto, RoomTaskDto } from '../types/api';
import { onRateLimit } from '../services/rateLimit';
import RoomPage from './RoomPage';

const live = vi.hoisted(() => {
  let connected = true;
  const listeners = new Set<() => void>();
  return {
    get: () => connected,
    set(value: boolean) { connected = value; listeners.forEach(listener => listener()); },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
});
vi.mock('../context/RealtimeContext', async () => {
  const { useSyncExternalStore } = await import('react');
  return { useRealtime: () => ({ connected: useSyncExternalStore(live.subscribe, live.get), state: null, error: null, synchronize: async () => {} }) };
});

beforeEach(() => { mockRoomViewport(); live.set(true); });

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
const bit = () => document.querySelector('.room-mascot-zone');

describe('room activity for friends', () => {
  it('tells the server which room this tab has open, again after a reconnect, and when the player leaves it', async () => {
    const calls: string[] = [];
    server.use(
      http.put(`${API_URL}/api/presence/room/7`, ({ request }) => { calls.push(`open:${new URL(request.url).searchParams.get('tab')}`); return new HttpResponse(null, { status: 204 }); }),
      http.delete(`${API_URL}/api/presence/room/7`, ({ request }) => { calls.push(`close:${new URL(request.url).searchParams.get('tab')}`); return new HttpResponse(null, { status: 204 }); }),
    );
    const room: RoomDetailDto = {
      id: 7, title: 'HTTP', description: 'Opis', shortDescription: '', difficulty: 'EASY', points: 50, solutionsCount: 0,
      createdAt: '2026-10-01T00:00:00', solved: false, requiresVpn: false, hints: [], unlockedHintIds: [], fileName: null,
      tasks: [{ id: 1, title: 'Zadanie', content: 'Treść', question: 'Pytanie?', completed: false }],
    };
    server.use(http.get(`${API_URL}/api/rooms/7`, () => HttpResponse.json(room)));
    setClerkSession(createToken('USER'));
    function Leave() { const navigate = useNavigate(); return <button type="button" onClick={() => navigate('/away')}>Wyjdź z testu</button>; }
    renderWithAuth(<>
      <Route path="/rooms/:id" element={<><RoomPage /><Leave /></>} />
      <Route path="/away" element={<p>Poza pokojem</p>} />
    </>, '/rooms/7');
    await waitFor(() => expect(calls).toHaveLength(1));
    const tab = calls[0].slice('open:'.length);
    expect(tab).toMatch(/^[A-Za-z0-9-]{1,64}$/);
    act(() => live.set(false));
    await waitFor(() => expect(calls).toEqual([`open:${tab}`, `close:${tab}`]));
    act(() => live.set(true));
    await waitFor(() => expect(calls).toHaveLength(3));
    await userEvent.click(screen.getByRole('button', { name: 'Wyjdź z testu' }));
    await waitFor(() => expect(calls).toEqual([`open:${tab}`, `close:${tab}`, `open:${tab}`, `close:${tab}`]));
  });

  it('waits for the live connection before announcing the room', async () => {
    live.set(false);
    let opened = 0;
    server.use(http.put(`${API_URL}/api/presence/room/7`, () => { opened += 1; return new HttpResponse(null, { status: 204 }); }));
    mount([{ id: 1, title: 'Zadanie', content: 'Treść', question: 'Pytanie?', completed: false }]);
    await screen.findByText('Zadanie');
    expect(opened).toBe(0);
    act(() => live.set(true));
    await waitFor(() => expect(opened).toBe(1));
  });
});

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

const hintTexts: Record<number, string> = { 1: 'Zajrzyj do źródła strony', 2: 'Szukaj komentarza' };

function mountCtf(overrides: Partial<RoomDetailDto> = {}, url = '/rooms/7') {
  const unlockedHintIds = overrides.unlockedHintIds ?? [];
  const hints = [1, 2].map((id, order) => unlockedHintIds.includes(id) ? { id, order, description: hintTexts[id] } : { id, order });
  const room: RoomDetailDto = {
    id: 7, title: 'Pierwsza flaga', description: 'Znajdź flagę', shortDescription: 'Rozgrzewka', difficulty: 'EASY',
    points: 50, solutionsCount: 3, createdAt: '2026-10-01T00:00:00', solved: false, requiresVpn: false,
    hints, unlockedHintIds, fileName: null, tasks: [], ...overrides,
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
    expect(bit()).toHaveAttribute('data-state', 'idle');
    await user.clear(input);
    await user.type(input, 'HA-ok');
    await user.click(screen.getByRole('button', { name: 'Zatwierdź' }));
    expect(await screen.findByText('Misja zakończona sukcesem!')).toBeInTheDocument();
    expect(document.querySelector('.success-flag .pixel-sprite')).toBeInTheDocument();
    expect(screen.getByText('+50')).toBeInTheDocument();
    expect(bit()).toHaveAttribute('data-state', 'idle');
    await user.click(screen.getByRole('button', { name: 'Kontynuuj' }));
    expect(bit()).toHaveAttribute('data-state', 'jump');
    expect(screen.queryByText('Misja zakończona sukcesem!')).not.toBeInTheDocument();
    expect(screen.getByText('Rozwiązania:')).toHaveTextContent('Rozwiązania: 4');
  });

  it('locks the flag form for the retry time after too many wrong flags and unlocks it afterwards', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const globalNotice = vi.fn();
      const stopListening = onRateLimit(globalNotice);
      let sent = 0;
      server.use(http.post(`${API_URL}/api/rooms/7/solve`, () => {
        sent++;
        return HttpResponse.json({ message: 'Zbyt wiele błędnych odpowiedzi w tym pokoju. Spróbuj ponownie za 2 s.', retryAfter: 2, reason: 'room-answer' },
          { status: 429, headers: { 'Retry-After': '2' } });
      }));
      mountCtf();
      await user.type(await screen.findByPlaceholderText('Wklej flagę tutaj...'), 'zla');
      await user.click(screen.getByRole('button', { name: 'Zatwierdź' }));

      expect(await screen.findByText('Zbyt wiele błędnych odpowiedzi. Spróbuj ponownie za 2 s.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Zatwierdź' })).toBeDisabled();
      expect(globalNotice).not.toHaveBeenCalled();
      stopListening();

      await act(async () => { vi.advanceTimersByTime(1000); });
      expect(screen.getByText('Zbyt wiele błędnych odpowiedzi. Spróbuj ponownie za 1 s.')).toBeInTheDocument();
      await act(async () => { vi.advanceTimersByTime(1000); });

      expect(screen.queryByText(/Spróbuj ponownie za/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Zatwierdź' })).toBeEnabled();
      await user.click(screen.getByRole('button', { name: 'Zatwierdź' }));
      await waitFor(() => expect(sent).toBe(2));
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports a network error while sending a flag', async () => {
    const user = userEvent.setup();
    server.use(http.post(`${API_URL}/api/rooms/7/solve`, () => HttpResponse.error()));
    mountCtf();
    await user.type(await screen.findByPlaceholderText('Wklej flagę tutaj...'), 'x');
    await user.click(screen.getByRole('button', { name: 'Zatwierdź' }));
    expect(await screen.findByText('Błąd sieci')).toBeInTheDocument();
    expect(bit()).toHaveAttribute('data-state', 'idle');
  });

  it('unlocks hints in order after confirming the point cost', async () => {
    const user = userEvent.setup();
    let unlocks = 0;
    server.use(http.post(`${API_URL}/api/rooms/7/hints/1/unlock`, () => { unlocks++; return HttpResponse.json({ id: 1, order: 0, description: hintTexts[1] }); }));
    mountCtf();
    expect(await screen.findByText('Punkty do zdobycia:')).toHaveTextContent('50');
    expect(screen.queryByText(hintTexts[1])).not.toBeInTheDocument();
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

describe('Bit room integration', () => {
  it('keeps Bit in the footer lane, away from long content, questions and expanded hints', async () => {
    mountCtf({ description: 'Długa treść '.repeat(1000), unlockedHintIds: [1, 2], requiresVpn: true, title: 'Tutorial VPN' });
    await screen.findByRole('heading', { name: 'Tutorial VPN' });
    expect(bit()).toHaveAttribute('data-state', 'idle');
    expect(bit()?.parentElement).toHaveClass('room-footer-lane');
    expect(bit()?.closest('.room-body-shell, .room-pane-scroll')).toBeNull();
    expect(document.querySelector('.room-body-shell .room-pane-scroll')).toHaveTextContent('Długa treść');
    expect(bit()?.querySelector('input, .room-prose, .room-hints')).toBeNull();
    expect(bit()?.querySelectorAll('button')).toHaveLength(1);
    expect(screen.getByText('Szukaj komentarza')).toBeInTheDocument();
  });

  it('reacts to a new task once, preserves its state when changing tasks and ignores restored completion', async () => {
    const tasks = [
      { id: 1, title: 'Pytanie', content: 'Treść '.repeat(1000), question: 'Co wpiszesz?', completed: false },
      { id: 2, title: 'Lektura', content: 'Druga treść', question: null, completed: false },
    ];
    server.use(http.post(`${API_URL}/api/rooms/7/tasks/1/solve`, () => HttpResponse.json({ success: true, message: 'Poprawna odpowiedź!' })));
    mount(tasks);
    const user = userEvent.setup();
    const input = await screen.findByRole('textbox', { name: 'Co wpiszesz?' });
    expect(bit()?.closest('.room-footer')).not.toBeNull();
    expect(bit()?.closest('.room-reader')).toBeNull();
    expect(bit()).toHaveAttribute('data-state', 'idle');
    await user.type(input, 'pwd');
    await user.click(screen.getByRole('button', { name: 'Sprawdź' }));
    await waitFor(() => expect(bit()).toHaveAttribute('data-state', 'jump'));
    const reaction = bit()?.getAttribute('data-reaction');
    await user.click(screen.getByRole('button', { name: 'Dalej' }));
    expect(await screen.findByRole('heading', { name: '02. Lektura' })).toBeInTheDocument();
    expect(bit()).toHaveAttribute('data-reaction', reaction);
  });

  it('does not celebrate previously completed tasks or unsuccessful task writes', async () => {
    server.use(http.post(`${API_URL}/api/rooms/7/tasks/2/solve`, () => HttpResponse.json({ success: false, message: 'Zapis nieudany' })));
    mount([
      { id: 1, title: 'Zrobione', content: 'Treść', question: null, completed: true },
      { id: 2, title: 'Nowe', content: 'Treść', question: null, completed: false },
    ]);
    expect(await screen.findByRole('heading', { name: '02. Nowe' })).toBeInTheDocument();
    expect(bit()).toHaveAttribute('data-state', 'idle');
    await userEvent.click(screen.getByRole('button', { name: 'Oznacz jako przeczytane' }));
    expect(await screen.findByText('Zapis nieudany')).toBeInTheDocument();
    expect(bit()).toHaveAttribute('data-state', 'idle');
    expect(screen.getByRole('button', { name: 'Oznacz jako przeczytane' })).toBeEnabled();
  });

  it('does not celebrate training repeats of an already solved CTF', async () => {
    server.use(http.post(`${API_URL}/api/rooms/7/solve`, () => HttpResponse.json({ success: true, message: 'Trening', pointsEarned: 0 })));
    mountCtf({ solved: true, requiresVpn: true, title: 'Tutorial VM' });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Rozwiąż ponownie (Trening)' }));
    expect(bit()).toHaveAttribute('data-state', 'idle');
    await user.type(screen.getByPlaceholderText('Wklej flagę tutaj...'), 'HA-ok');
    await user.click(screen.getByRole('button', { name: 'Zatwierdź' }));
    await user.click(await screen.findByRole('button', { name: 'Kontynuuj' }));
    expect(bit()).toHaveAttribute('data-state', 'idle');
  });

  it('does not treat an unsuccessful flag response as a completion even with HTTP 200', async () => {
    server.use(http.post(`${API_URL}/api/rooms/7/solve`, () => HttpResponse.json({ success: false, message: 'Nie zapisano' })));
    mountCtf();
    const user = userEvent.setup();
    await user.type(await screen.findByPlaceholderText('Wklej flagę tutaj...'), 'HA-ok');
    await user.click(screen.getByRole('button', { name: 'Zatwierdź' }));
    expect(await screen.findByText('Nie zapisano')).toBeInTheDocument();
    expect(bit()).toHaveAttribute('data-state', 'idle');
    expect(screen.queryByText('Misja zakończona sukcesem!')).not.toBeInTheDocument();
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
    expect(await screen.findByRole('button', { name: 'Poprawne' })).toBeDisabled();
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

  it('locks task answers with a neutral message when a general write limit answers', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      server.use(http.post(`${API_URL}/api/rooms/7/tasks/1/solve`, () => new HttpResponse(null, { status: 429, headers: { 'Retry-After': '1' } })));
      mount([{ id: 1, title: 'Pierwsze', content: 'A', question: 'Ile?', completed: false }]);
      await user.type(await screen.findByLabelText('Ile?'), 'zle');
      await user.click(screen.getByRole('button', { name: 'Sprawdź' }));

      expect(await screen.findByText('Zbyt wiele żądań. Spróbuj ponownie za 1 s.')).toBeInTheDocument();
      expect(screen.queryByText(/błędnych odpowiedzi/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sprawdź' })).toBeDisabled();
      expect(screen.getByLabelText('Ile?')).toBeDisabled();

      await act(async () => { vi.advanceTimersByTime(1000); });

      expect(screen.queryByText(/Spróbuj ponownie za/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sprawdź' })).toBeEnabled();
      expect(screen.getByLabelText('Ile?')).toHaveValue('zle');
    } finally {
      vi.useRealTimers();
    }
  });

  it('opens the first unfinished task and leaves a finished room for the path list', async () => {
    mount([
      { id: 1, title: 'Pierwsze', content: 'A', question: 'Ile?', completed: true },
      { id: 2, title: 'Drugie', content: 'B', question: 'Co?', completed: true },
    ]);
    expect(await screen.findByRole('heading', { name: '01. Pierwsze' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dalej' })).not.toBeInTheDocument();
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
    expect(await screen.findByText('Rozwiązany')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Następny pokój' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/rooms/8:PUSH');
  });

  it('returns a solved task room without a path to learning', async () => {
    mountSolved([{ id: 1, title: 'Jedyne', content: 'A', question: null, completed: true }], '/rooms/7');
    await userEvent.click(await screen.findByRole('button', { name: 'Zakończ' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/learn:PUSH');
  });
});

describe('bug reports from a room', () => {
  it('reports a problem with the task the player is reading', async () => {
    let body: unknown = null;
    server.use(http.post(`${API_URL}/api/bug-reports`, async ({ request }) => {
      body = await request.json();
      return HttpResponse.json({ message: 'ok' }, { status: 201 });
    }));
    mount([
      { id: 1, title: 'Pierwsze', content: 'A', question: null, completed: true },
      { id: 2, title: 'Drugie', content: 'B', question: 'Ile?', completed: false },
    ]);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Lista zadań' }));
    await user.click(screen.getByRole('button', { name: /Drugie/ }));
    await user.click(screen.getByRole('button', { name: 'Zgłoś błąd' }));
    await user.type(await screen.findByLabelText('Opis problemu'), 'Pytanie nie przyjmuje odpowiedzi');
    await user.click(screen.getByRole('button', { name: 'Wyślij zgłoszenie' }));
    await waitFor(() => expect(body).toEqual({ source: 'ROOM', roomId: 7, taskId: 2, pagePath: '/rooms/7', description: 'Pytanie nie przyjmuje odpowiedzi' }));
  });

  it('reports a flag room without a task', async () => {
    let body: unknown = null;
    server.use(http.post(`${API_URL}/api/bug-reports`, async ({ request }) => {
      body = await request.json();
      return HttpResponse.json({ message: 'ok' }, { status: 201 });
    }));
    mount([]);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Zgłoś błąd' }));
    await user.type(await screen.findByLabelText('Opis problemu'), 'Plik do pobrania jest pusty');
    await user.click(screen.getByRole('button', { name: 'Wyślij zgłoszenie' }));
    await waitFor(() => expect(body).toEqual({ source: 'ROOM', roomId: 7, pagePath: '/rooms/7', description: 'Plik do pobrania jest pusty' }));
  });
});
