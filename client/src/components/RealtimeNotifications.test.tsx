import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { defaultNotificationPreferences } from '../services/userApi';
import type { RealtimeState } from '../types/realtime';
import type { GameSession } from '../types/api';
import RealtimeNotifications from './RealtimeNotifications';
import RealtimeGameNavigation from './RealtimeGameNavigation';

const environment = vi.hoisted(() => ({ token: 'first', state: null as RealtimeState | null,
  preferences: { friendRequests: true, challenges: true, matchFound: true, sound: false, browserNotifications: true } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ token: environment.token }) }));
vi.mock('../context/RealtimeContext', () => ({ useRealtime: () => ({ state: environment.state }) }));
vi.mock('../context/NotificationPreferencesContext', () => ({ useNotificationPreferences: () => ({ preferences: environment.preferences, loaded: true }) }));

const delivered = vi.fn();
const snapshot = (): RealtimeState => ({ streamId: 'stream', revision: 1, friendRequests: [], challenges: [],
  friends: [], outgoingChallenges: [], gameSession: null, queued: false });
const request = { id: 7, requesterUsername: 'friend', createdAt: '2026-10-11T12:00:00' };

beforeEach(() => {
  delivered.mockClear();
  environment.token = 'first';
  environment.state = snapshot();
  environment.preferences = { ...defaultNotificationPreferences, browserNotifications: true };
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  vi.stubGlobal('Notification', class {
    static permission = 'granted';
    constructor(title: string, options: NotificationOptions) { delivered(title, options); }
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('realtime notification delivery', () => {
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
    environment.token = 'second';
    environment.state = { ...snapshot(), friendRequests: [request] };
    rerender(<RealtimeNotifications />);
    expect(delivered).not.toHaveBeenCalled();
    environment.state = { ...snapshot(), revision: 2, friendRequests: [request, { ...request, id: 9 }] };
    rerender(<RealtimeNotifications />);
    expect(delivered).toHaveBeenCalledTimes(1);
  });

  it('continues navigating to a match when all notification categories are muted', () => {
    environment.preferences = { friendRequests: false, challenges: false, matchFound: false, sound: false, browserNotifications: false };
    function Location() { const location = useLocation(); return <output>{location.pathname}{location.search}</output>; }
    const content = <MemoryRouter><RealtimeNotifications /><RealtimeGameNavigation /><Location /></MemoryRouter>;
    const { rerender, container } = render(content);
    const game: GameSession = { id: 'match', status: 'ACTIVE', player1Id: 1, player1Username: 'first', player1Elo: 500,
      player2Id: 2, player2Username: 'second', player2Elo: 500, roomId: 7, startTime: '2026-10-11T12:00:00',
      winnerId: null, player1EloChange: null, player2EloChange: null, hintsUsed: {}, finishTimes: {}, penaltiesInSeconds: {} };
    environment.state = { ...snapshot(), revision: 2, gameSession: game };
    rerender(<MemoryRouter><RealtimeNotifications /><RealtimeGameNavigation /><Location /></MemoryRouter>);
    expect(container.querySelector('output')).toHaveTextContent('/rooms/7?arena=match');
    expect(delivered).not.toHaveBeenCalled();
  });
});
