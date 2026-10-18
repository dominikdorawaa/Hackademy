import { describe, expect, it } from 'vitest';
import { roomHref } from './roomReturn';

describe('roomHref', () => {
  it('encodes where the room was opened from', () => {
    expect(roomHref(7)).toBe('/rooms/7');
    expect(roomHref(7, { kind: 'dashboard' })).toBe('/rooms/7?from=dashboard');
    expect(roomHref(7, { kind: 'path', pathId: 3 })).toBe('/rooms/7?pathId=3');
  });
});
