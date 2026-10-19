import type { DifficultyLevel } from '../../types/api';

export function plural(count: number, forms: [string, string, string]) {
  const lastDigit = count % 10;
  const lastTwo = count % 100;
  if (count === 1) return forms[0];
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) return forms[1];
  return forms[2];
}

export const difficultyLabels: Record<DifficultyLevel, string> = {
  EASY: 'Łatwy',
  MEDIUM: 'Średni',
  HARD: 'Trudny',
  INSANE: 'Niemożliwy',
};

export { errorText } from '../../lib/errorText';

export const dateTimeFormat = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short' });

export const dateFormat = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium' });

export const numberFormat = new Intl.NumberFormat('pl-PL');
