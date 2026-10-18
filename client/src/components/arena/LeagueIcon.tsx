import type { CSSProperties } from 'react';
import type { League } from './leagues';
import './LeagueIcon.css';

export function LeagueIcon({ league, className, glint = false }: { league: League; className?: string; glint?: boolean }) {
  return (
    <span className={className ? `league-icon ${className}` : 'league-icon'} data-league={league.id} data-glint={glint} style={{ '--league-icon': `url(${league.icon})` } as CSSProperties} aria-hidden="true">
      <img src={league.icon} alt="" width={32} height={32} />
    </span>
  );
}
