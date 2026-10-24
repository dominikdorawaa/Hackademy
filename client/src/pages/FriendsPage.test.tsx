import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import API_URL from '../apiConfig';
import { server } from '../test/mocks/server';
import type { FriendDto } from '../types/api';
import type { RealtimeState } from '../types/realtime';
import FriendsPage from './FriendsPage';

const environment = vi.hoisted(() => ({ state: null as RealtimeState | null, error: null as string | null, synchronize: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ token: 'token' }) }));
vi.mock('../context/RealtimeContext', () => ({
  useRealtime: () => ({ state: environment.state, error: environment.error, synchronize: environment.synchronize }),
}));

const friend = (id: number, username: string, online: boolean): FriendDto => ({ id, username, points: 100, streak: 1, online });
const snapshot = (friends: FriendDto[]): RealtimeState => ({ streamId: 'stream', revision: 1, friendRequests: [],
  friends, challenges: [], outgoingChallenges: [], expiredChallenges: [], rejectedChallenges: [], serverTime: 0, gameSession: null, queued: false });

function mount() {
  return render(<MemoryRouter><FriendsPage /></MemoryRouter>);
}

beforeEach(() => {
  environment.synchronize = vi.fn().mockResolvedValue(undefined);
  environment.error = null;
  environment.state = snapshot([friend(2, 'ola', true), friend(3, 'kuba', false)]);
});

describe('friends page', () => {
  it('shows whether each friend is online', () => {
    mount();
    const ola = screen.getByRole('link', { name: 'ola' }).parentElement!;
    const kuba = screen.getByRole('link', { name: 'kuba' }).parentElement!;
    expect(within(ola).getByText('Online')).toBeInTheDocument();
    expect(within(kuba).getByText('Offline')).toBeInTheDocument();
  });

  it('asks for confirmation instead of the browser dialog and cancels without removing', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    const removed = vi.fn();
    server.use(http.delete(`${API_URL}/api/friends/:id`, () => { removed(); return HttpResponse.json({}); }));
    mount();
    const user = userEvent.setup();
    const remove = screen.getByRole('button', { name: 'Usuń ola ze znajomych' });
    await user.click(remove);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('ola zniknie z Twojej listy znajomych');
    expect(within(dialog).getByRole('button', { name: 'Anuluj' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Anuluj' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await waitFor(() => expect(remove).toHaveFocus());
    await user.click(remove);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await waitFor(() => expect(remove).toHaveFocus());
    expect(removed).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('removes the friend after confirmation and moves focus to the friend list heading', async () => {
    const removed = vi.fn();
    server.use(http.delete(`${API_URL}/api/friends/:id`, ({ params }) => { removed(params.id); return HttpResponse.json({}); }));
    mount();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Usuń kuba ze znajomych' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Usuń' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(removed).toHaveBeenCalledWith('3');
    expect(environment.synchronize).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('heading', { name: /Twoi Znajomi/ })).toHaveFocus());
  });

  it('keeps the dialog open and explains a failed removal', async () => {
    server.use(http.delete(`${API_URL}/api/friends/:id`, () => HttpResponse.json({ message: 'nope' }, { status: 500 })));
    mount();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Usuń ola ze znajomych' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Usuń' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się usunąć znajomego');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(environment.synchronize).not.toHaveBeenCalled();
  });

  it('offers a retry when the friend list cannot load', async () => {
    environment.state = null;
    environment.error = 'Brak połączenia';
    mount();
    expect(screen.getByRole('alert')).toHaveTextContent('Brak połączenia');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    expect(environment.synchronize).toHaveBeenCalled();
  });

  it('shows an empty state without friends', () => {
    environment.state = snapshot([]);
    mount();
    expect(screen.getByText('Nie masz jeszcze żadnych znajomych.')).toBeInTheDocument();
  });

  it('searches users and sends a friend request', async () => {
    const sent = vi.fn();
    server.use(
      http.get(`${API_URL}/api/user/search`, () => HttpResponse.json([
        { id: 5, username: 'nowy', friendshipStatus: 'NONE' },
        { id: 6, username: 'ja', friendshipStatus: 'SELF' },
        { id: 7, username: 'stary', friendshipStatus: 'FRIENDS' },
        { id: 8, username: 'czeka', friendshipStatus: 'REQUEST_RECEIVED' },
      ])),
      http.post(`${API_URL}/api/friends/request/:username`, ({ params }) => { sent(params.username); return HttpResponse.json({}); }),
    );
    mount();
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Wpisz nazwę użytkownika...'), 'no');
    await user.click(screen.getByRole('button', { name: 'Szukaj' }));
    await user.click(await screen.findByRole('button', { name: 'Dodaj' }));
    expect(await screen.findByText('Wysłano')).toBeInTheDocument();
    expect(sent).toHaveBeenCalledWith('nowy');
    expect(screen.getByText('Ty')).toBeInTheDocument();
    expect(screen.getAllByText('Znajomi')).toHaveLength(2);
    expect(screen.getByText('Oczekuje')).toBeInTheDocument();
  });

  it('accepts and rejects pending requests', async () => {
    const calls: string[] = [];
    server.use(
      http.post(`${API_URL}/api/friends/accept/:id`, ({ params }) => { calls.push(`accept ${params.id}`); return HttpResponse.json({}); }),
      http.post(`${API_URL}/api/friends/reject/:id`, ({ params }) => { calls.push(`reject ${params.id}`); return HttpResponse.json({}); }),
    );
    environment.state = { ...snapshot([]), friendRequests: [{ id: 11, requesterUsername: 'ania', createdAt: '2026-10-19T10:00:00' }] };
    mount();
    const user = userEvent.setup();
    expect(screen.getByText('Oczekujące Zaproszenia (1)')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Przyjmij zaproszenie od ania' }));
    await user.click(screen.getByRole('button', { name: 'Odrzuć zaproszenie od ania' }));
    await waitFor(() => expect(calls).toEqual(['accept 11', 'reject 11']));
    expect(environment.synchronize).toHaveBeenCalledTimes(2);
  });

  it('challenges a friend and reports a refused challenge', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    let refuse = false;
    server.use(http.post(`${API_URL}/api/arena/challenge/create`, () => refuse
      ? HttpResponse.json({ message: 'Zajęty' }, { status: 400 }) : HttpResponse.json({})));
    mount();
    const user = userEvent.setup();
    const [first, second] = screen.getAllByRole('button', { name: /Wyzwij/ });
    await user.click(first);
    await waitFor(() => expect(environment.synchronize).toHaveBeenCalled());
    refuse = true;
    await user.click(second);
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Błąd: Zajęty'));
  });

  it('marks friends who were already challenged', () => {
    environment.state = { ...snapshot([friend(2, 'ola', true)]), outgoingChallenges: [{ id: 'c', challengerId: 1,
      challengerUsername: 'me', targetId: 2, targetUsername: 'ola', createdAt: '2026-10-19T10:00:00', status: 'PENDING', expiresAt: 1_060_000 }] };
    mount();
    expect(screen.getByRole('button', { name: 'Wyzwano' })).toBeDisabled();
  });
});
