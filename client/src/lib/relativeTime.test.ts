import { describe, expect, it } from 'vitest';
import { formatRelativeTimePL } from './relativeTime';

const now = Date.parse('2026-10-20T12:00:00Z');
const ago = (ms: number) => formatRelativeTimePL(now - ms, now);

describe('relative time in Polish', () => {
  it('counts minutes, hours and days back from now', () => {
    expect(ago(20_000)).toBe('przed chwilą');
    expect(ago(5 * 60_000)).toBe('5 min temu');
    expect(ago(3 * 3_600_000)).toBe('3h temu');
    expect(ago(26 * 3_600_000)).toBe('wczoraj');
    expect(ago(3 * 86_400_000)).toBe('3 dni temu');
  });
});
