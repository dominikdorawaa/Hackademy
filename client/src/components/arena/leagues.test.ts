import { expect, it } from 'vitest';
import { LEAGUES, leagueFor, leagueProgress } from './leagues';

it('places Elo in a league and names the next one', () => {
  expect(leagueFor(500)).toMatchObject({ league: { name: 'Script Kiddie' }, next: { name: 'Skaner', min: 600 } });
  expect(leagueFor(800)).toMatchObject({ league: { name: 'Exploit' }, next: { name: 'Root' } });
  expect(leagueFor(1086)).toMatchObject({ league: { name: 'Root' }, next: { name: 'Zero-day', min: 1200 } });
  expect(leagueFor(1500)).toMatchObject({ league: { name: 'Zero-day' }, next: null });
  expect(leagueFor(-20).league.name).toBe('Script Kiddie');
});

it('keeps the Elo thresholds and gives every league its own icon and colour', () => {
  expect(LEAGUES.map(league => league.min)).toEqual([0, 600, 800, 1000, 1200]);
  expect(new Set(LEAGUES.map(league => league.icon)).size).toBe(LEAGUES.length);
  expect(new Set(LEAGUES.map(league => league.color)).size).toBe(LEAGUES.length);
  for (const league of LEAGUES) expect(league.icon).toBe(`/assets/arena/leagues/${league.id}.png`);
  expect(leagueFor(599).league.id).toBe('script-kiddie');
  expect(leagueFor(600).league.id).toBe('skaner');
  expect(leagueFor(1199).league.id).toBe('root');
  expect(leagueFor(1200).league.id).toBe('zero-day');
});

it('measures the way from the league threshold to the next one', () => {
  expect(leagueProgress(857)).toBeCloseTo(0.285);
  expect(leagueProgress(800)).toBe(0);
  expect(leagueProgress(-20)).toBe(0);
  expect(leagueProgress(1500)).toBe(1);
});
