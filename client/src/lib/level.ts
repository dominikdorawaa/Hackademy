export const levelFromPoints = (points: number) => Math.floor((Number(points) || 0) / 100) + 1;

const HINT_PENALTY = 0.25;

export const xpAfterHints = (points: number, hints: number) => Math.max(0, Math.trunc((Number(points) || 0) * (1 - hints * HINT_PENALTY)));

export const rankTitleFromPoints = (points: number) => {
  const level = levelFromPoints(points);
  if (level <= 3) return 'Freshman';
  if (level <= 6) return 'Junior';
  if (level <= 10) return 'Apprentice';
  if (level <= 15) return 'Developer';
  if (level <= 20) return 'Senior';
  return 'Architect';
};
