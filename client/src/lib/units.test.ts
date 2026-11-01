import { describe, expect, it } from 'vitest';
import { formatElo, formatEloChange, formatNumberPL, formatXp, unitFor } from './units';

describe('units', () => {
  it('formats XP as a whole Polish number with the unit', () => {
    expect(formatXp(30)).toBe('30 XP');
    expect(formatXp(12450)).toBe(`${(12450).toLocaleString('pl-PL')} XP`);
    expect(formatXp(22.5)).toBe('22 XP');
  });

  it('treats missing values as zero', () => {
    expect(formatXp(Number.NaN)).toBe('0 XP');
    expect(formatNumberPL(undefined)).toBe('0');
    expect(formatElo(null)).toBe('0 Elo');
  });

  it('formats Elo and signed Elo changes', () => {
    expect(formatElo(1240)).toBe(`${(1240).toLocaleString('pl-PL')} Elo`);
    expect(formatEloChange(16)).toBe('+16 Elo');
    expect(formatEloChange(-16)).toBe('-16 Elo');
    expect(formatEloChange(0)).toBe('0 Elo');
  });

  it('picks the unit for a ranking metric', () => {
    expect(unitFor('points')).toBe('XP');
    expect(unitFor('elo')).toBe('Elo');
  });
});
