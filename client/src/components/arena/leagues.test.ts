import { expect, it } from 'vitest';
import { leagueFor } from './leagues';

it('places Elo in a league and names the next one', () => {
  expect(leagueFor(500)).toMatchObject({ league: { name: 'Brąz' }, next: { name: 'Srebro', min: 600 } });
  expect(leagueFor(800)).toMatchObject({ league: { name: 'Złoto' }, next: { name: 'Platyna' } });
  expect(leagueFor(1086)).toMatchObject({ league: { name: 'Platyna' }, next: { name: 'Diament', min: 1200 } });
  expect(leagueFor(1500)).toMatchObject({ league: { name: 'Diament' }, next: null });
  expect(leagueFor(-20).league.name).toBe('Brąz');
});
