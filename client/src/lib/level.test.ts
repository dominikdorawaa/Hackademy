import { describe, expect, it } from 'vitest';
import { xpAfterHints } from './level';

describe('xpAfterHints', () => {
  it('takes a tenth of the room per hint and truncates like the server does', () => {
    expect(xpAfterHints(30, 0)).toBe(30);
    expect(xpAfterHints(55, 1)).toBe(49);
    expect(xpAfterHints(30, 2)).toBe(24);
    expect(xpAfterHints(100, 4)).toBe(60);
  });

  it('never takes more than half of the room', () => {
    expect(xpAfterHints(100, 5)).toBe(50);
    expect(xpAfterHints(100, 6)).toBe(50);
    expect(xpAfterHints(15, 12)).toBe(7);
  });
});
