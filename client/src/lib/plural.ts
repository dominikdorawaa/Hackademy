export function plural(count: number, [one, few, many]: readonly [string, string, string]) {
  const tens = count % 100;
  const units = count % 10;
  const word = count === 1 ? one : units >= 2 && units <= 4 && (tens < 12 || tens > 14) ? few : many;
  return `${count} ${word}`;
}

export const ROOMS = ['pokój', 'pokoje', 'pokoi'] as const;
export const CHAPTERS = ['rozdział', 'rozdziały', 'rozdziałów'] as const;
