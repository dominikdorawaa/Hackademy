import { Link } from 'react-router-dom';
import UserAvatar from '../../UserAvatar';
import type { ArenaMatchSummary } from '../../../types/api';
import { formatEloChange } from '../../../lib/units';
import { formatBattleDate, resultLabel, resultTone } from './battleHistory';

export function BattleRow({ battle, now }: { battle: ArenaMatchSummary; now?: Date }) {
  const tone = resultTone(battle.result);
  return (
    <li>
      <Link className="bh-row" to={`/arena/history/${battle.id}`}>
        <UserAvatar className="bh-row-avatar" username={battle.opponentName} avatar={battle.opponentAvatar} alt="" />
        <span className="bh-row-who">
          <span className="bh-row-title"><b className={`bh-tone-${tone}`}>{resultLabel(battle.result)}</b> z <b>{battle.opponentName}</b></span>
          <span className="bh-row-date">{formatBattleDate(battle.finishedAt, now)}</span>
        </span>
        <span className={`bh-row-elo bh-tone-${tone}`}>{formatEloChange(battle.eloChange)}</span>
        <i className="fas fa-chevron-right bh-row-chevron" aria-hidden="true"></i>
      </Link>
    </li>
  );
}
