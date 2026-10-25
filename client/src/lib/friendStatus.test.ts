import { describe, expect, it } from 'vitest';
import { friendActivity, friendStatus } from './friendStatus';

const now = Date.parse('2026-10-25T12:00:00Z');

describe('friend status', () => {
  it('names what an online friend is doing', () => {
    expect(friendStatus({ online: true, activity: 'DUEL' }, now)).toBe('w pojedynku');
    expect(friendStatus({ online: true, activity: 'ARENA_QUEUE' }, now)).toBe('w kolejce Areny');
    expect(friendStatus({ online: true, activity: 'ROOM', activityRoom: 'Ukryty skarb' }, now)).toBe('rozwiązuje pokój Ukryty skarb');
    expect(friendStatus({ online: true, activity: 'ROOM', activityRoom: null }, now)).toBe('online');
    expect(friendStatus({ online: true }, now)).toBe('online');
  });

  it('tells when an offline friend was last seen', () => {
    expect(friendStatus({ online: false, lastSeenAt: now - 2 * 3_600_000 }, now)).toBe('ostatnio online 2h temu');
    expect(friendStatus({ online: false, lastSeenAt: null }, now)).toBe('offline');
  });

  it('has nothing to add when only presence is known', () => {
    expect(friendActivity({ online: true }, now)).toBeNull();
    expect(friendActivity({ online: false }, now)).toBeNull();
  });
});
