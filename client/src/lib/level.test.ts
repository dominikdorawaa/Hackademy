import { describe, expect, it } from 'vitest';
import { xpAfterHints } from './level';

describe('xpAfterHints', () => {
  it('truncates the hint-reduced reward like the server does', () => {
    expect(xpAfterHints(30, 0)).toBe(30);
    expect(xpAfterHints(30, 1)).toBe(22);
    expect(xpAfterHints(30, 2)).toBe(15);
    expect(xpAfterHints(30, 5)).toBe(0);
  });
});
