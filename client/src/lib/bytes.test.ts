import { expect, it } from 'vitest';
import { bytesWord, formatBytes, formatMoney, isLocked, paidItem } from './bytes';
import { createShop } from '../test/fixtures/shop';

it('uses the right Polish form of Bajt', () => {
  expect([1, 2, 4, 5, 12, 22, 25, 0, -3].map(bytesWord)).toEqual(['Bajt', 'Bajty', 'Bajty', 'Bajtów', 'Bajtów', 'Bajty', 'Bajtów', 'Bajtów', 'Bajty']);
  expect(formatBytes(1200)).toBe('1200 Bajtów');
  expect(formatBytes(12000).replace(/\s/g, ' ')).toBe('12 000 Bajtów');
  expect(formatMoney(1999, 'PLN').replace(/\s/g, ' ')).toBe('19,99 zł');
});

it('treats paid items as locked until the shop says they are owned', () => {
  expect(isLocked(null, 'DANCE', 'scuba')).toBe(true);
  expect(isLocked(null, 'DANCE', 'groove')).toBe(false);
  expect(isLocked(null, 'QUICK_CHAT', 'rematch')).toBe(true);
  expect(isLocked(null, 'OUTFIT', 'dres')).toBe(false);
  expect(isLocked(createShop(['dance-scuba']), 'DANCE', 'scuba')).toBe(false);
  expect(isLocked(createShop([]), 'DANCE', 'scuba')).toBe(true);
  expect(paidItem('DANCE', 'scuba', null)?.price).toBe(400);
  expect(paidItem('DANCE', 'scuba', createShop([]))?.price).toBe(400);
});
