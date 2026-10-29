export const levelFromPoints = (points: number) => Math.floor((Number(points) || 0) / 100) + 1;

export const rankTitleFromPoints = (points: number) => {
  const level = levelFromPoints(points);
  if (level <= 3) return 'Freshman';
  if (level <= 6) return 'Junior';
  if (level <= 10) return 'Apprentice';
  if (level <= 15) return 'Developer';
  if (level <= 20) return 'Senior';
  return 'Architect';
};
