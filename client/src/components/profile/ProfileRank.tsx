import { LeagueIcon } from '../arena/LeagueIcon';
import { leagueFor } from '../arena/leagues';
import { levelFromPoints, rankTitleFromPoints } from '../../lib/level';

// The learning title comes from XP and the league from arena Elo, so each carries its own label.
export default function ProfileRank({ points, elo }: { points: number; elo?: number }) {
  const league = elo === undefined ? null : leagueFor(elo).league;
  return <dl className="profile-rank">
    <div><dt>Ranga nauki</dt>
      <dd><strong>{rankTitleFromPoints(points)}</strong><span>Poziom {levelFromPoints(points)}</span></dd></div>
    {league && <div><dt>Liga areny</dt>
      <dd><LeagueIcon league={league} className="profile-rank-league" /><strong>{league.name}</strong><span>{elo!.toLocaleString('pl-PL')} Elo</span></dd></div>}
  </dl>;
}
