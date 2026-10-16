export interface League { name: string; min: number; color: string }

export const LEAGUES: League[] = [
  { name: 'Brąz', min: 0, color: '#c98a52' },
  { name: 'Srebro', min: 600, color: '#aebcd0' },
  { name: 'Złoto', min: 800, color: '#e3b341' },
  { name: 'Platyna', min: 1000, color: '#4fd1c5' },
  { name: 'Diament', min: 1200, color: '#8fb3ff' },
];

export function leagueFor(elo: number) {
  const at = Math.max(0, LEAGUES.filter(league => elo >= league.min).length - 1);
  return { league: LEAGUES[at], next: LEAGUES[at + 1] ?? null };
}
