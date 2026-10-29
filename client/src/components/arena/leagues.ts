export type LeagueId = 'script-kiddie' | 'skaner' | 'exploit' | 'root' | 'zero-day';
export interface League { id: LeagueId; name: string; min: number; color: string; icon: string }

const ICONS = '/assets/arena/leagues/';

export const LEAGUES: League[] = [
  { id: 'script-kiddie', name: 'Script Kiddie', min: 0, color: '#c98a52', icon: `${ICONS}script-kiddie.png` },
  { id: 'skaner', name: 'Skaner', min: 600, color: '#aebcd0', icon: `${ICONS}skaner.png` },
  { id: 'exploit', name: 'Exploit', min: 800, color: '#e3b341', icon: `${ICONS}exploit.png` },
  { id: 'root', name: 'Root', min: 1000, color: '#4fd1c5', icon: `${ICONS}root.png` },
  { id: 'zero-day', name: 'Zero-day', min: 1200, color: '#8fb3ff', icon: `${ICONS}zero-day.png` },
];

export function leagueFor(elo: number) {
  const at = Math.max(0, LEAGUES.filter(league => elo >= league.min).length - 1);
  return { league: LEAGUES[at], next: LEAGUES[at + 1] ?? null };
}

export function leagueProgress(elo: number) {
  const { league, next } = leagueFor(elo);
  return next ? Math.min(1, Math.max(0, (elo - league.min) / (next.min - league.min))) : 1;
}
