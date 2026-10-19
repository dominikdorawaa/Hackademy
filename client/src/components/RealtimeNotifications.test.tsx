import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { defaultNotificationPreferences } from '../services/userApi';
import type { RealtimeState } from '../types/realtime';
import RealtimeNotifications, { ONLINE_TOAST_COOLDOWN_MS, TOAST_DURATION_MS, describeFriendsOnline } from './RealtimeNotifications';
import RealtimeGameNavigation from './RealtimeGameNavigation';
import { createGameSession } from '../test/fixtures/arena';

const environment = vi.hoisted(() => ({ sessionKey: 'first', state: null as RealtimeState | null, loaded: true,
  preferences: { friendRequests: true, challenges: true, matchFound: true, sound: false, browserNotifications: true, friendOnline: true } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ sessionKey: environment.sessionKey }) }));
vi.mock('../context/RealtimeContext', () => ({ useRealtime: () => ({ state: environment.state }) }));
const sounds = vi.hoisted(() => ({ play: vi.fn(() => true), unlock: vi.fn(async () => true) }));
vi.mock('../lib/notificationSounds', async importOriginal => ({
  ...await importOriginal<typeof import('../lib/notificationSounds')>(), playSound: sounds.play, unlockAudio: sounds.unlock }));
vi.mock('../context/NotificationPreferencesContext', () => ({ useNotificationPreferences: () => ({ preferences: environment.preferences, loaded: environment.loaded }) }));

const delivered = vi.fn();
const snapshot = (): RealtimeState => ({ streamId: 'stream', revision: 1, friendRequests: [], challenges: [],
  friends: [], outgoingChallenges: [], gameSession: null, queued: false });
const request = { id: 7, requesterUsername: 'friend', createdAt: '2026-10-11T12:00:00' };

beforeEach(() => {
  delivered.mockClear();
  sounds.play.mockClear();
  sounds.unlock.mockClear();
  environment.sessionKey = 'first';
  environment.state = snapshot();
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
        targetUsername: 'first', createdAt: request.createdAt, status: 'PENDING' }],
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
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(delivered).not.toHaveBeenCalled();
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
