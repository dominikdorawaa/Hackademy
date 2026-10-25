import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { defaultNotificationPreferences } from '../services/userApi';
import type { RealtimeState } from '../types/realtime';
import RealtimeNotifications, { ONLINE_TOAST_COOLDOWN_MS, TOAST_DURATION_MS, describeFriendsOnline, describeInvitations, CHALLENGE_TOAST_DURATION_MS } from './RealtimeNotifications';
import RealtimeGameNavigation from './RealtimeGameNavigation';
import { createGameSession } from '../test/fixtures/arena';
import { avatarFromUsername, toAvatarConfig } from './arena/avatar/avatarModel';
import type { AvatarConfig } from '../types/api';

const environment = vi.hoisted(() => ({ sessionKey: 'first', state: null as RealtimeState | null, connected: true, loaded: true,
  user: null as { username: string; avatar?: AvatarConfig | null } | null,
  preferences: { friendRequests: true, challenges: true, matchFound: true, sound: false, browserNotifications: true, friendOnline: true } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ sessionKey: environment.sessionKey, user: environment.user }) }));
vi.mock('./arena/avatar/useAvatarAtlas', () => ({
  useAvatarPortrait: (config: AvatarConfig | null | undefined) => config ? `blob:${config.outfit}-${config.hair}-${config.skin}` : null,
}));
vi.mock('../context/RealtimeContext', () => ({ useRealtime: () => ({ state: environment.state, connected: environment.connected, synchronize: async () => {} }) }));
const sounds = vi.hoisted(() => ({ play: vi.fn(() => true), unlock: vi.fn(async () => true) }));
vi.mock('../lib/notificationSounds', async importOriginal => ({
  ...await importOriginal<typeof import('../lib/notificationSounds')>(), playSound: sounds.play, unlockAudio: sounds.unlock }));
vi.mock('../context/NotificationPreferencesContext', () => ({ useNotificationPreferences: () => ({ preferences: environment.preferences, loaded: environment.loaded }) }));

const answers = vi.hoisted(() => {
  const state = { calls: [] as string[], ok: true, gate: null as Promise<void> | null,
    answer: (name: string) => async (id: string | number) => {
      state.calls.push(`${name}:${id}`);
      if (state.gate) await state.gate;
      return { ok: state.ok } as Response;
    } };
  return state;
});
vi.mock('../services/friendApi', () => ({ acceptRequest: answers.answer('friend-accept'), rejectRequest: answers.answer('friend-reject') }));
vi.mock('../services/arenaApi', () => ({ acceptChallenge: answers.answer('challenge-accept'), rejectChallenge: answers.answer('challenge-reject') }));

const delivered = vi.fn();
const snapshot = (): RealtimeState => ({ streamId: 'stream', revision: 1, friendRequests: [], challenges: [],
  friends: [], outgoingChallenges: [], expiredChallenges: [], rejectedChallenges: [], serverTime: 0, gameSession: null, queued: false });
const request = { id: 7, requesterUsername: 'friend', createdAt: '2026-10-11T12:00:00' };

beforeEach(() => {
  delivered.mockClear();
  sounds.play.mockClear();
  sounds.unlock.mockClear();
  environment.sessionKey = 'first';
  environment.user = null;
  environment.state = snapshot();
  environment.connected = true;
  environment.loaded = true;
  environment.preferences = { ...defaultNotificationPreferences, browserNotifications: true };
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  vi.stubGlobal('Notification', class {
    static permission = 'granted';
    constructor(title: string, options: NotificationOptions) { delivered(title, options); }
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('realtime notification delivery', () => {
  it('delivers requests, challenges and matches received during preference loading exactly once', () => {
    environment.loaded = false;
    environment.state!.friendRequests = [request];
    const { rerender } = render(<RealtimeNotifications />);
    environment.state = { ...snapshot(), revision: 2, friendRequests: [request, { ...request, id: 8 }],
      challenges: [{ id: 'challenge', challengerId: 2, challengerUsername: 'second', targetId: 1,
        targetUsername: 'first', createdAt: request.createdAt, status: 'PENDING', expiresAt: 1_060_000 }],
      gameSession: createGameSession({ id: 'match', player1Username: 'first', player2Username: 'second' }) };
    rerender(<RealtimeNotifications />);
    expect(delivered).not.toHaveBeenCalled();
    environment.loaded = true;
    rerender(<RealtimeNotifications />);
    expect(delivered).toHaveBeenCalledTimes(3);
    expect(delivered.mock.calls.map(call => call[1].tag)).toEqual(['friend:8', 'challenge:challenge', 'match:match']);
    environment.state = { ...environment.state, revision: 3 };
    rerender(<RealtimeNotifications />);
    expect(delivered).toHaveBeenCalledTimes(3);
  });

  it('applies the loaded choices to pending events and does not replay muted events', () => {
    environment.loaded = false;
    const { rerender } = render(<RealtimeNotifications />);
    environment.state = { ...snapshot(), revision: 2, friendRequests: [request] };
    rerender(<RealtimeNotifications />);
    environment.preferences = { ...environment.preferences, friendRequests: false };
    environment.loaded = true;
    rerender(<RealtimeNotifications />);
    expect(delivered).not.toHaveBeenCalled();
    environment.preferences = { ...environment.preferences, friendRequests: true };
    rerender(<RealtimeNotifications />);
    expect(delivered).not.toHaveBeenCalled();
  });

  it('discards pending alerts when their request disappears or the account changes', () => {
    environment.loaded = false;
    const { rerender } = render(<RealtimeNotifications />);
    environment.state = { ...snapshot(), revision: 2, friendRequests: [request] };
    rerender(<RealtimeNotifications />);
    environment.state = { ...snapshot(), revision: 3 };
    rerender(<RealtimeNotifications />);
    environment.loaded = true;
    rerender(<RealtimeNotifications />);
    expect(delivered).not.toHaveBeenCalled();
    environment.loaded = false;
    environment.state = { ...snapshot(), revision: 4, friendRequests: [{ ...request, id: 9 }] };
    rerender(<RealtimeNotifications />);
    environment.sessionKey = 'second';
    environment.state = snapshot();
    environment.loaded = true;
    rerender(<RealtimeNotifications />);
    expect(delivered).not.toHaveBeenCalled();
  });

  it('suppresses initial snapshots and deduplicates changes across reconnect snapshots', () => {
    environment.state!.friendRequests = [request];
    const { rerender } = render(<RealtimeNotifications />);
    expect(delivered).not.toHaveBeenCalled();
    environment.state = { ...snapshot(), revision: 2, friendRequests: [request, { ...request, id: 8 }] };
    rerender(<RealtimeNotifications />);
    expect(delivered).toHaveBeenCalledTimes(1);
    environment.state = { ...environment.state, revision: 3 };
    rerender(<RealtimeNotifications />);
    expect(delivered).toHaveBeenCalledTimes(1);
    environment.state = { ...snapshot(), revision: 4 };
    rerender(<RealtimeNotifications />);
    environment.state = { ...snapshot(), revision: 5, friendRequests: [{ ...request, id: 8 }] };
    rerender(<RealtimeNotifications />);
    expect(delivered).toHaveBeenCalledTimes(1);
  });

  it('does not deliver muted categories or replay them when unmuted', () => {
    environment.preferences.friendRequests = false;
    const { rerender } = render(<RealtimeNotifications />);
    environment.state = { ...snapshot(), revision: 2, friendRequests: [request] };
    rerender(<RealtimeNotifications />);
    expect(delivered).not.toHaveBeenCalled();
    environment.preferences = { ...environment.preferences, friendRequests: true };
    rerender(<RealtimeNotifications />);
    expect(delivered).not.toHaveBeenCalled();
  });

  it('resets the notification baseline when accounts change', () => {
    const { rerender } = render(<RealtimeNotifications />);
    environment.sessionKey = 'second';
    environment.state = { ...snapshot(), friendRequests: [request] };
    rerender(<RealtimeNotifications />);
    expect(delivered).not.toHaveBeenCalled();
    environment.state = { ...snapshot(), revision: 2, friendRequests: [request, { ...request, id: 9 }] };
    rerender(<RealtimeNotifications />);
    expect(delivered).toHaveBeenCalledTimes(1);
  });

  it('continues navigating to a match when all notification categories are muted', () => {
    environment.preferences = { friendRequests: false, challenges: false, matchFound: false, sound: false, browserNotifications: false, friendOnline: false };
    function Location() { const location = useLocation(); return <output>{location.pathname}{location.search}</output>; }
    const content = <MemoryRouter><RealtimeNotifications /><RealtimeGameNavigation /><Location /></MemoryRouter>;
    const { rerender, container } = render(content);
    const game = createGameSession({ id: 'match', player1Username: 'first', player2Username: 'second' });
    environment.state = { ...snapshot(), revision: 2, gameSession: game };
    rerender(<MemoryRouter><RealtimeNotifications /><RealtimeGameNavigation /><Location /></MemoryRouter>);
    expect(container.querySelector('output')).toHaveTextContent('/arena/battle/match');
    expect(delivered).not.toHaveBeenCalled();
  });

  it('plays one signal for the most urgent new event only when sound is on', () => {
    environment.preferences = { ...environment.preferences, sound: true };
    const { rerender } = render(<RealtimeNotifications />);
    environment.state = { ...snapshot(), revision: 2, friendRequests: [request],
      gameSession: createGameSession({ id: 'match', player1Username: 'first', player2Username: 'second' }) };
    rerender(<RealtimeNotifications />);
    expect(sounds.play).toHaveBeenCalledTimes(1);
    expect(sounds.play).toHaveBeenCalledWith('matchFound');
    environment.preferences = { ...environment.preferences, sound: false };
    environment.state = { ...environment.state, revision: 3, friendRequests: [request, { ...request, id: 8 }] };
    rerender(<RealtimeNotifications />);
    expect(sounds.play).toHaveBeenCalledTimes(1);
  });

  it('stays silent for muted categories and unlocks audio on the first interaction', () => {
    environment.preferences = { ...environment.preferences, sound: true, friendRequests: false };
    const { rerender } = render(<RealtimeNotifications />);
    document.dispatchEvent(new Event('pointerdown'));
    expect(sounds.unlock).toHaveBeenCalledTimes(1);
    environment.state = { ...snapshot(), revision: 2, friendRequests: [request] };
    rerender(<RealtimeNotifications />);
    expect(sounds.play).not.toHaveBeenCalled();
  });

  it('keeps a found match silent when its switch is off', () => {
    environment.preferences = { ...environment.preferences, sound: true, matchFound: false };
    const { rerender } = render(<RealtimeNotifications />);
    environment.state = { ...snapshot(), revision: 2,
      gameSession: createGameSession({ id: 'match', player1Username: 'first', player2Username: 'second' }) };
    rerender(<RealtimeNotifications />);
    expect(sounds.play).not.toHaveBeenCalled();
    expect(delivered).not.toHaveBeenCalled();
  });
});

describe('friend online toasts', () => {
  const friend = (id: number, username: string, online: boolean) => ({ id, username, points: 0, streak: 0, online });
  const withFriends = (revision: number, ...friends: ReturnType<typeof friend>[]) => ({ ...snapshot(), revision, friends });

  it('treats friends already online in the first snapshot as the baseline', () => {
    environment.state = withFriends(1, friend(2, 'ola', true));
    render(<RealtimeNotifications />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(delivered).not.toHaveBeenCalled();
  });

  it('announces a friend coming online but not going offline', () => {
    environment.state = withFriends(1, friend(2, 'ola', false));
    const { rerender } = render(<RealtimeNotifications />);
    environment.state = withFriends(2, friend(2, 'ola', true));
    rerender(<RealtimeNotifications />);
    expect(screen.getByRole('status')).toHaveTextContent('ola jest online');
    expect(delivered).toHaveBeenCalledWith('Znajomy online', expect.objectContaining({ tag: 'online:2' }));
    environment.state = withFriends(3, friend(2, 'ola', false));
    rerender(<RealtimeNotifications />);
    expect(screen.getAllByText(/online/)).toHaveLength(1);
    expect(delivered).toHaveBeenCalledTimes(1);
  });

  it('groups friends who come online together', () => {
    environment.state = withFriends(1, friend(2, 'ola', false), friend(3, 'kuba', false), friend(4, 'ewa', false));
    const { rerender } = render(<RealtimeNotifications />);
    environment.state = withFriends(2, friend(2, 'ola', true), friend(3, 'kuba', true), friend(4, 'ewa', true));
    rerender(<RealtimeNotifications />);
    expect(screen.getByRole('status')).toHaveTextContent('ola i 2 innych znajomych są online');
    expect(describeFriendsOnline(['ola', 'kuba'])).toBe('ola i kuba są online');
    expect(delivered).toHaveBeenCalledTimes(1);
    expect(delivered).toHaveBeenCalledWith('Znajomi online', expect.objectContaining({ tag: 'online:2,3,4' }));
  });

  it('does not announce a new or re-added friend who was already online', () => {
    environment.state = withFriends(1);
    const { rerender } = render(<RealtimeNotifications />);
    environment.state = withFriends(2, friend(2, 'ola', true));
    rerender(<RealtimeNotifications />);
    environment.state = withFriends(3);
    rerender(<RealtimeNotifications />);
    environment.state = withFriends(4, friend(2, 'ola', true));
    rerender(<RealtimeNotifications />);
    expect(screen.queryByText(/jest online/)).not.toBeInTheDocument();
    expect(delivered).not.toHaveBeenCalledWith('Znajomy online', expect.anything());
  });

  it('announces the same friend at most once per cooldown', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    try {
      environment.state = withFriends(1, friend(2, 'ola', false));
      const { rerender } = render(<RealtimeNotifications />);
      environment.state = withFriends(2, friend(2, 'ola', true));
      rerender(<RealtimeNotifications />);
      act(() => { vi.advanceTimersByTime(TOAST_DURATION_MS); });
      expect(screen.getByRole('status')).toBeEmptyDOMElement();
      environment.state = withFriends(3, friend(2, 'ola', false));
      rerender(<RealtimeNotifications />);
      environment.state = withFriends(4, friend(2, 'ola', true));
      rerender(<RealtimeNotifications />);
      expect(screen.getByRole('status')).toBeEmptyDOMElement();
      act(() => { vi.advanceTimersByTime(ONLINE_TOAST_COOLDOWN_MS); });
      environment.state = withFriends(5, friend(2, 'ola', false));
      rerender(<RealtimeNotifications />);
      environment.state = withFriends(6, friend(2, 'ola', true));
      rerender(<RealtimeNotifications />);
      expect(screen.getByRole('status')).toHaveTextContent('ola jest online');
      expect(delivered).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stays silent when the friend online preference is off', () => {
    environment.preferences = { ...environment.preferences, friendOnline: false };
    environment.state = withFriends(1, friend(2, 'ola', false));
    const { rerender } = render(<RealtimeNotifications />);
    environment.state = withFriends(2, friend(2, 'ola', true));
    rerender(<RealtimeNotifications />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(delivered).not.toHaveBeenCalled();
  });

  it('lets the viewer dismiss a toast', () => {
    environment.state = withFriends(1, friend(2, 'ola', false));
    const { rerender } = render(<RealtimeNotifications />);
    environment.state = withFriends(2, friend(2, 'ola', true));
    rerender(<RealtimeNotifications />);
    fireEvent.click(screen.getByRole('button', { name: 'Zamknij powiadomienie' }));
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('plays the friend online sound when a friend comes online', () => {
    environment.preferences = { ...environment.preferences, sound: true };
    environment.state = withFriends(1, friend(2, 'ola', false));
    const { rerender } = render(<RealtimeNotifications />);
    environment.state = withFriends(2, friend(2, 'ola', true));
    rerender(<RealtimeNotifications />);
    expect(sounds.play).toHaveBeenCalledTimes(1);
    expect(sounds.play).toHaveBeenCalledWith('friendOnline');
  });
});

describe('accepted invitation toasts', () => {
  const friend = (id: number, username: string) => ({ id, username, points: 0, streak: 0, online: true });

  it('tells the inviter that their invitation was accepted', () => {
    const { rerender } = render(<RealtimeNotifications />);
    environment.state = { ...snapshot(), revision: 2, friends: [friend(2, 'ola')] };
    rerender(<RealtimeNotifications />);
    expect(screen.getByRole('status')).toHaveTextContent('ola przyjmuje Twoje zaproszenie do znajomych.');
    expect(delivered).toHaveBeenCalledWith('Zaproszenie przyjęte', expect.objectContaining({ tag: 'accepted:2' }));
    environment.state = { ...snapshot(), revision: 3, friends: [friend(2, 'ola')] };
    rerender(<RealtimeNotifications />);
    expect(screen.getAllByText(/przyjmuje Twoje zaproszenie/)).toHaveLength(1);
  });

  it('stays quiet when the viewer accepts an invitation, or friends were there from the start', () => {
    environment.state = { ...snapshot(), friends: [friend(3, 'kuba')], friendRequests: [request] };
    const { rerender } = render(<RealtimeNotifications />);
    environment.state = { ...snapshot(), revision: 2, friends: [friend(3, 'kuba'), friend(7, 'friend')] };
    rerender(<RealtimeNotifications />);
    expect(screen.queryByText(/przyjmuje Twoje zaproszenie/)).not.toBeInTheDocument();
    expect(delivered).not.toHaveBeenCalled();
  });

  it('follows the friend request switch and waits for loaded preferences', () => {
    environment.loaded = false;
    const { rerender } = render(<RealtimeNotifications />);
    environment.state = { ...snapshot(), revision: 2, friends: [friend(2, 'ola')] };
    rerender(<RealtimeNotifications />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    environment.loaded = true;
    environment.state = { ...environment.state, revision: 3 };
    rerender(<RealtimeNotifications />);
    expect(screen.getByRole('status')).toHaveTextContent('ola przyjmuje');
    environment.preferences = { ...environment.preferences, friendRequests: false };
    environment.state = { ...snapshot(), revision: 4, friends: [friend(2, 'ola'), friend(4, 'ewa')] };
    rerender(<RealtimeNotifications />);
    expect(screen.queryByText(/ewa przyjmuje/)).not.toBeInTheDocument();
  });
});

describe('expired challenge toasts', () => {
  const expired = (id: string, targetUsername: string) => ({ id, challengerId: 1, challengerUsername: 'first', targetId: 2,
    targetUsername, createdAt: '2026-10-24T12:00:00', status: 'EXPIRED' as const, expiresAt: 1_060_000 });
  const withExpired = (revision: number, ...expiredChallenges: ReturnType<typeof expired>[]) => ({ ...snapshot(), revision, expiredChallenges });

  it('tells the challenger once that their challenge expired, without a sound or system notification', () => {
    environment.preferences = { ...environment.preferences, sound: true };
    environment.state = withExpired(1, expired('old', 'kuba'));
    const { rerender } = render(<RealtimeNotifications />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    environment.state = withExpired(2, expired('old', 'kuba'), expired('new', 'ola'));
    rerender(<RealtimeNotifications />);
    expect(screen.getByRole('status')).toHaveTextContent('Wyzwanie dla ola wygasło bez odpowiedzi.');
    environment.state = withExpired(3, expired('new', 'ola'));
    rerender(<RealtimeNotifications />);
    environment.state = withExpired(4, expired('new', 'ola'));
    rerender(<RealtimeNotifications />);
    expect(screen.getAllByText(/wygasło/)).toHaveLength(1);
    expect(screen.queryByText(/kuba/)).not.toBeInTheDocument();
    expect(sounds.play).not.toHaveBeenCalled();
    expect(delivered).not.toHaveBeenCalled();
  });

  it('does not present challenges that expired while the connection was down as new after reconnecting', () => {
    environment.state = withExpired(1);
    const { rerender } = render(<RealtimeNotifications />);
    environment.connected = false;
    rerender(<RealtimeNotifications />);
    environment.connected = true;
    rerender(<RealtimeNotifications />);
    environment.state = withExpired(2, expired('missed', 'kuba'));
    rerender(<RealtimeNotifications />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    environment.state = withExpired(3, expired('missed', 'kuba'), expired('new', 'ola'));
    rerender(<RealtimeNotifications />);
    expect(screen.getByRole('status')).toHaveTextContent('Wyzwanie dla ola wygasło bez odpowiedzi.');
    expect(screen.queryByText(/kuba/)).not.toBeInTheDocument();
  });

  it('keeps waiting for a fresh state when preferences change while the connection is down', () => {
    environment.state = withExpired(1);
    const { rerender } = render(<RealtimeNotifications />);
    environment.connected = false;
    rerender(<RealtimeNotifications />);
    environment.preferences = { ...environment.preferences, sound: true };
    rerender(<RealtimeNotifications />);
    environment.connected = true;
    rerender(<RealtimeNotifications />);
    environment.preferences = { ...environment.preferences, sound: false };
    rerender(<RealtimeNotifications />);
    environment.state = withExpired(2, expired('missed', 'kuba'));
    rerender(<RealtimeNotifications />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    environment.state = withExpired(3, expired('missed', 'kuba'), expired('new', 'ola'));
    rerender(<RealtimeNotifications />);
    expect(screen.getByRole('status')).toHaveTextContent('Wyzwanie dla ola wygasło bez odpowiedzi.');
    expect(screen.queryByText(/kuba/)).not.toBeInTheDocument();
  });

  it('waits for the loaded preferences and stays silent when challenge notifications are off', () => {
    environment.loaded = false;
    environment.state = withExpired(1);
    const { rerender } = render(<RealtimeNotifications />);
    environment.state = withExpired(2, expired('new', 'ola'));
    rerender(<RealtimeNotifications />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    environment.preferences = { ...environment.preferences, challenges: false };
    environment.loaded = true;
    environment.state = withExpired(3, expired('new', 'ola'));
    rerender(<RealtimeNotifications />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});

describe('rejected challenges', () => {
  it('leave the toast corner alone, because the bell and the arena show them', () => {
    environment.state = snapshot();
    const { rerender } = render(<RealtimeNotifications />);
    environment.state = { ...snapshot(), revision: 2, rejectedChallenges: [{ id: 'no', challengerId: 1, challengerUsername: 'first',
      targetId: 2, targetUsername: 'ola', createdAt: '2026-10-24T12:00:00', status: 'REJECTED', expiresAt: 1_060_000 }] };
    rerender(<RealtimeNotifications />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(sounds.play).not.toHaveBeenCalled();
    expect(delivered).not.toHaveBeenCalled();
  });
});

describe('invitation toasts', () => {
  const challenge = { id: 'duel', challengerId: 2, challengerUsername: 'kuba', targetId: 1, targetUsername: 'first',
    createdAt: request.createdAt, status: 'PENDING' as const, expiresAt: 1_060_000 };

  it('briefly shows a new friend request and challenge in the corner as well as in the bell', () => {
    const { rerender } = render(<RealtimeNotifications />);
    environment.state = { ...snapshot(), revision: 2, friendRequests: [request], challenges: [challenge] };
    rerender(<RealtimeNotifications />);
    expect(screen.getByRole('status')).toHaveTextContent(/friend\s*chce dodać Cię do znajomych/);
    expect(screen.getByRole('status')).toHaveTextContent(/kuba\s*wyzywa Cię na pojedynek/);
  });

  it('sums up a burst of invitations in one toast', () => {
    const { rerender } = render(<RealtimeNotifications />);
    environment.state = { ...snapshot(), revision: 2, friendRequests: [request, { ...request, id: 8 }, { ...request, id: 9 }] };
    rerender(<RealtimeNotifications />);
    expect(screen.getByText('Masz 3 nowe zaproszenia. Znajdziesz je w dzwonku')).toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  it('stays quiet for invitations switched off in settings', () => {
    environment.preferences = { ...environment.preferences, friendRequests: false };
    const { rerender } = render(<RealtimeNotifications />);
    environment.state = { ...snapshot(), revision: 2, friendRequests: [request] };
    rerender(<RealtimeNotifications />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it.each([[3, 'nowe zaproszenia'], [5, 'nowych zaproszeń'], [12, 'nowych zaproszeń'], [22, 'nowe zaproszenia']])('declines %i invitations', (count, words) => {
    expect(describeInvitations(count)).toBe(`Masz ${count} ${words}. Znajdziesz je w dzwonku`);
  });
});

describe('invitation toast actions', () => {
  const challenge = { id: 'duel', challengerId: 2, challengerUsername: 'kuba', targetId: 1, targetUsername: 'first',
    createdAt: request.createdAt, status: 'PENDING' as const, expiresAt: 1_060_000 };

  it('tells a friend request from a challenge by its heading and lets the viewer answer right away', async () => {
    answers.calls = [];
    answers.ok = true;
    const { rerender } = render(<RealtimeNotifications />);
    environment.state = { ...snapshot(), revision: 2, friendRequests: [request], challenges: [challenge] };
    rerender(<RealtimeNotifications />);
    const friendToast = screen.getByRole('group', { name: 'Zaproszenie do znajomych' });
    const challengeToast = screen.getByRole('group', { name: 'Wyzwanie w Arenie' });
    expect(friendToast).toHaveAttribute('data-kind', 'friend');
    expect(challengeToast).toHaveAttribute('data-kind', 'challenge');
    fireEvent.click(within(friendToast).getByRole('button', { name: 'Akceptuj' }));
    fireEvent.click(within(challengeToast).getByRole('button', { name: 'Odrzuć' }));
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Zaproszenie do znajomych' })).not.toBeInTheDocument());
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Wyzwanie w Arenie' })).not.toBeInTheDocument());
    expect(answers.calls.sort()).toEqual(['challenge-reject:duel', 'friend-accept:7']);
  });

  it('keeps the toast with an error when answering fails', async () => {
    answers.ok = false;
    const { rerender } = render(<RealtimeNotifications />);
    environment.state = { ...snapshot(), revision: 2, friendRequests: [request] };
    rerender(<RealtimeNotifications />);
    fireEvent.click(screen.getByRole('button', { name: 'Akceptuj' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się');
    expect(screen.getByRole('button', { name: 'Akceptuj' })).toBeEnabled();
    answers.ok = true;
  });

  it('holds the countdown while hovered and resumes it on leave', () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(<RealtimeNotifications />);
      environment.state = { ...snapshot(), revision: 2, friendRequests: [request] };
      rerender(<RealtimeNotifications />);
      const toast = screen.getByRole('group', { name: 'Zaproszenie do znajomych' });
      act(() => { vi.advanceTimersByTime(TOAST_DURATION_MS - 1000); });
      fireEvent.mouseEnter(toast);
      expect(toast).toHaveAttribute('data-paused', 'true');
      act(() => { vi.advanceTimersByTime(TOAST_DURATION_MS * 3); });
      expect(screen.getByRole('group', { name: 'Zaproszenie do znajomych' })).toBeInTheDocument();
      fireEvent.mouseLeave(toast);
      act(() => { vi.advanceTimersByTime(1000); });
      expect(screen.queryByRole('group', { name: 'Zaproszenie do znajomych' })).not.toBeInTheDocument();
    } finally { vi.useRealTimers(); }
  });

  it('shows the Elo of both fighters on a challenge', () => {
    const { rerender } = render(<RealtimeNotifications />);
    environment.state = { ...snapshot(), revision: 2, challenges: [{ ...challenge, challengerElo: 812, targetElo: 455 }] };
    rerender(<RealtimeNotifications />);
    const duel = screen.getByRole('group', { name: 'Wyzwanie w Arenie' });
    expect(within(duel).getByLabelText('Elo kuba: 812')).toHaveTextContent('812 Elo');
    expect(within(duel).getByLabelText('Twoje Elo: 455')).toBeInTheDocument();
  });

  it('keeps a challenge on screen longer than a friend request', () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(<RealtimeNotifications />);
      environment.state = { ...snapshot(), revision: 2, friendRequests: [request], challenges: [challenge] };
      rerender(<RealtimeNotifications />);
      act(() => { vi.advanceTimersByTime(TOAST_DURATION_MS); });
      expect(screen.queryByRole('group', { name: 'Zaproszenie do znajomych' })).not.toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Wyzwanie w Arenie' })).toBeInTheDocument();
      act(() => { vi.advanceTimersByTime(CHALLENGE_TOAST_DURATION_MS - TOAST_DURATION_MS); });
      expect(screen.queryByRole('group', { name: 'Wyzwanie w Arenie' })).not.toBeInTheDocument();
    } finally { vi.useRealTimers(); }
  });

  it('keeps a toast while its answer is still being sent, then shows the failure', async () => {
    vi.useFakeTimers();
    let finish!: () => void;
    answers.gate = new Promise(resolve => { finish = resolve; });
    answers.ok = false;
    try {
      const { rerender } = render(<RealtimeNotifications />);
      environment.state = { ...snapshot(), revision: 2, friendRequests: [request] };
      rerender(<RealtimeNotifications />);
      const toast = screen.getByRole('group', { name: 'Zaproszenie do znajomych' });
      fireEvent.click(within(toast).getByRole('button', { name: 'Akceptuj' }));
      fireEvent.mouseLeave(toast);
      fireEvent.blur(toast);
      act(() => { vi.advanceTimersByTime(TOAST_DURATION_MS * 3); });
      expect(screen.getByRole('group', { name: 'Zaproszenie do znajomych' })).toBeInTheDocument();
      await act(async () => { finish(); await Promise.resolve(); await Promise.resolve(); });
      expect(screen.getByRole('alert')).toHaveTextContent('Nie udało się');
      act(() => { vi.advanceTimersByTime(TOAST_DURATION_MS); });
      expect(screen.queryByRole('group', { name: 'Zaproszenie do znajomych' })).not.toBeInTheDocument();
    } finally {
      answers.gate = null;
      answers.ok = true;
      vi.useRealTimers();
    }
  });

  it('folds invitations arriving one by one into a single summary once three are on screen', () => {
    const { rerender } = render(<RealtimeNotifications />);
    environment.state = { ...snapshot(), revision: 2, friendRequests: [request] };
    rerender(<RealtimeNotifications />);
    environment.state = { ...snapshot(), revision: 3, friendRequests: [request], challenges: [challenge] };
    rerender(<RealtimeNotifications />);
    expect(screen.getAllByRole('group')).toHaveLength(2);
    environment.state = { ...snapshot(), revision: 4, friendRequests: [request, { ...request, id: 8 }], challenges: [challenge] };
    rerender(<RealtimeNotifications />);
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(screen.getByText('Masz 3 nowe zaproszenia. Znajdziesz je w dzwonku')).toBeInTheDocument();
    environment.state = { ...snapshot(), revision: 5, friendRequests: [request, { ...request, id: 8 }, { ...request, id: 9 }], challenges: [challenge] };
    rerender(<RealtimeNotifications />);
    expect(screen.getByText('Masz 4 nowe zaproszenia. Znajdziesz je w dzwonku')).toBeInTheDocument();
    expect(screen.queryByText(/Masz 3/)).not.toBeInTheDocument();
  });

  it('drops the toast once the invitation was answered in the bell', () => {
    const { rerender } = render(<RealtimeNotifications />);
    environment.state = { ...snapshot(), revision: 2, friendRequests: [request] };
    rerender(<RealtimeNotifications />);
    expect(screen.getByRole('group', { name: 'Zaproszenie do znajomych' })).toBeInTheDocument();
    environment.state = { ...snapshot(), revision: 3 };
    rerender(<RealtimeNotifications />);
    expect(screen.queryByRole('group', { name: 'Zaproszenie do znajomych' })).not.toBeInTheDocument();
  });
});

describe('invitation toast portraits', () => {
  const look = (outfit: string, hair: string): AvatarConfig => ({ outfit, hair, hat: 'brak', skin: 'jasna', hairColor: 'rude',
    topColor: 'bialy', bottomColor: 'granatowy', shoesColor: 'czerwony', hatColor: 'bialy' });
  const portrait = (avatar: AvatarConfig) => `blob:${avatar.outfit}-${avatar.hair}-${avatar.skin}`;
  const challenge = (challengerAvatar?: AvatarConfig | null) => ({ id: 'duel', challengerId: 2, challengerUsername: 'kuba', targetId: 1,
    targetUsername: 'first', createdAt: request.createdAt, status: 'PENDING' as const, expiresAt: 1_060_000, challengerAvatar });
  const portraits = (name: string) => [...screen.getByRole('group', { name }).querySelectorAll('img.invite-portrait')];

  it('puts the challenger and the viewer side by side with their saved avatars', () => {
    const own = look('baza', 'krotkie');
    const challenger = look('dres', 'kucyk');
    environment.user = { username: 'first', avatar: own };
    const { rerender } = render(<RealtimeNotifications />);
    environment.state = { ...snapshot(), revision: 2, challenges: [challenge(challenger)] };
    rerender(<RealtimeNotifications />);
    const [them, me] = portraits('Wyzwanie w Arenie');
    expect(them).toHaveAttribute('src', portrait(challenger));
    expect(them).toHaveAttribute('data-avatar', 'custom');
    expect(me).toHaveAttribute('src', portrait(own));
    expect(me).toHaveClass('invite-portrait-own');
  });

  it('follows an avatar changed while the toast is still on screen', () => {
    const { rerender } = render(<RealtimeNotifications />);
    environment.state = { ...snapshot(), revision: 2, friendRequests: [{ ...request, avatar: look('bluza', 'irokez') }], challenges: [challenge(look('dres', 'kucyk'))] };
    rerender(<RealtimeNotifications />);
    const changed = look('baza', 'brak');
    environment.state = { ...snapshot(), revision: 3, friendRequests: [{ ...request, avatar: changed }], challenges: [challenge(changed)] };
    rerender(<RealtimeNotifications />);
    expect(portraits('Zaproszenie do znajomych')[0]).toHaveAttribute('src', portrait(changed));
    expect(portraits('Wyzwanie w Arenie')[0]).toHaveAttribute('src', portrait(changed));
    environment.state = { ...snapshot(), revision: 4, challenges: [challenge(null)] };
    rerender(<RealtimeNotifications />);
    expect(portraits('Wyzwanie w Arenie')[0]).toHaveAttribute('data-avatar', 'generated');
  });

  it('draws accounts without a saved avatar from their name, the viewer included', () => {
    environment.user = { username: 'first', avatar: null };
    const { rerender } = render(<RealtimeNotifications />);
    environment.state = { ...snapshot(), revision: 2, friendRequests: [request], challenges: [challenge()] };
    rerender(<RealtimeNotifications />);
    expect(portraits('Zaproszenie do znajomych')[0]).toHaveAttribute('src', portrait(toAvatarConfig(avatarFromUsername('friend'))));
    const [them, me] = portraits('Wyzwanie w Arenie');
    expect(them).toHaveAttribute('src', portrait(toAvatarConfig(avatarFromUsername('kuba'))));
    expect(me).toHaveAttribute('src', portrait(toAvatarConfig(avatarFromUsername('first'))));
    for (const image of [them, me]) expect(image).toHaveAttribute('data-avatar', 'generated');
  });
});
