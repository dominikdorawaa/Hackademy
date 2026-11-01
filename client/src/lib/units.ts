export const XP_UNIT = 'XP';
export const ELO_UNIT = 'Elo';

export type ScoreMetric = 'points' | 'elo';

type Score = number | null | undefined;

const toWholeNumber = (n: Score) => Math.trunc(Number(n) || 0);

export const unitFor = (metric: ScoreMetric) => metric === 'points' ? XP_UNIT : ELO_UNIT;

export const formatNumberPL = (n: Score) => toWholeNumber(n).toLocaleString('pl-PL');

export const formatXp = (n: Score) => `${formatNumberPL(n)} ${XP_UNIT}`;

export const formatElo = (n: Score) => `${formatNumberPL(n)} ${ELO_UNIT}`;

export const formatEloChange = (n: Score) => `${toWholeNumber(n) > 0 ? '+' : ''}${formatElo(n)}`;
