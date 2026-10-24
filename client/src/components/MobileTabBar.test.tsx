import { setClerkSession } from '../test/clerk';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { createToken } from '../test/fixtures/auth';
import { renderWithAuth } from '../test/renderWithAuth';
import type { RealtimeState } from '../types/realtime';
import MobileTabBar, { showsMobileTabBar } from './MobileTabBar';
import SiteLayout from './SiteLayout';

const realtime = vi.hoisted(() => ({ state: null as RealtimeState | null }));
vi.mock('../context/RealtimeContext', async importOriginal => ({
  ...await importOriginal<typeof import('../context/RealtimeContext')>(),
  useRealtime: () => ({ state: realtime.state, connected: true, error: null, synchronize: async () => {} }),
}));

const duel = { id: 'duel', challengerId: 2, challengerUsername: 'kuba', targetId: 1, targetUsername: 'tester',
  createdAt: '2026-10-25T12:00:00', status: 'PENDING' as const, expiresAt: 1_060_000 };
const state = (challenges: RealtimeState['challenges']): RealtimeState => ({ streamId: 's', revision: 1, friendRequests: [], friends: [],
  challenges, outgoingChallenges: [], expiredChallenges: [], rejectedChallenges: [], gameSession: null, queued: false, serverTime: 0 });

describe('mobile tab bar', () => {
  it('marks the section of the current page, including its sub-pages, and moves with navigation', async () => {
    realtime.state = state([]);
    renderWithAuth(<Route path="*" element={<MobileTabBar />} />, '/learn/paths/3');
    const bar = screen.getByRole('navigation', { name: 'Nawigacja na telefonie' });
    expect(within(bar).getAllByRole('link').map(link => link.textContent)).toEqual(['Start', 'Ucz się', 'Arena', 'Ranking']);
    expect(within(bar).getByRole('link', { name: 'Ucz się' })).toHaveAttribute('aria-current', 'page');
    await userEvent.click(within(bar).getByRole('link', { name: 'Ranking' }));
    expect(within(bar).getByRole('link', { name: 'Ranking' })).toHaveAttribute('aria-current', 'page');
    expect(within(bar).getByRole('link', { name: 'Ucz się' })).not.toHaveAttribute('aria-current');
  });

  it('flags the arena tab while a duel is waiting for an answer', () => {
    realtime.state = state([duel]);
    renderWithAuth(<Route path="*" element={<MobileTabBar />} />, '/dashboard');
    expect(screen.getByRole('link', { name: /Arena, czekające wyzwania: 1/ })).toBeInTheDocument();
  });

  it('leaves full-screen pages alone', () => {
    expect(['/witaj', '/arena/battle/abc', '/learn/ukos', '/login', '/register'].map(showsMobileTabBar)).toEqual([false, false, false, false, false]);
    expect(['/dashboard', '/learn', '/arena', '/arena/avatar', '/ranking', '/profile', '/settings'].every(showsMobileTabBar)).toBe(true);
  });

  it('shows only to signed-in users inside the site layout', async () => {
    realtime.state = state([]);
    const page = <Route element={<SiteLayout />}><Route path="*" element={<h1>Strona</h1>} /></Route>;
    const visitor = renderWithAuth(page, '/ranking');
    await screen.findByRole('heading', { name: 'Strona' });
    expect(screen.queryByRole('navigation', { name: 'Nawigacja na telefonie' })).not.toBeInTheDocument();
    visitor.unmount();
    setClerkSession(createToken());
    const { container } = renderWithAuth(page, '/ranking');
    expect(await screen.findByRole('navigation', { name: 'Nawigacja na telefonie' })).toBeInTheDocument();
    expect(container.querySelector('.site-shell--tabbar')).not.toBeNull();
  });
});
