export const levelFromPoints = (points: number) => Math.floor((Number(points) || 0) / 100) + 1;

const HINT_PENALTY_PERCENT = 10;
const MAX_HINT_PENALTY_PERCENT = 50;

export const xpAfterHints = (points: number, hints: number) =>
  Math.trunc(Math.max(0, Number(points) || 0) * (100 - Math.min(Math.max(0, hints) * HINT_PENALTY_PERCENT, MAX_HINT_PENALTY_PERCENT)) / 100);

export const rankTitleFromPoints = (points: number) => {
  const level = levelFromPoints(points);
  if (level <= 3) return 'Freshman';
  if (level <= 6) return 'Junior';
  if (level <= 10) return 'Apprentice';
  if (level <= 15) return 'Developer';
  if (level <= 20) return 'Senior';
  return 'Architect';
};
