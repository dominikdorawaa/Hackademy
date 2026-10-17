import type { CSSProperties } from 'react';
import { IMPACT_MS, LAUNCH_MS } from './battleView';
import type { RoundResult } from '../../../types/api';

const EFFECTS = '/assets/arena/effects/';

export function BattleEffects({ round, meId, rivalId }: { round: RoundResult | null; meId: number; rivalId: number }) {
  if (!round) return null;
  const timing = { '--launch': `${LAUNCH_MS}ms`, '--impact': `${IMPACT_MS}ms` } as CSSProperties;
  const shots = [
    { from: 'me', damage: round.damage[rivalId] ?? 0 },
    { from: 'rival', damage: round.damage[meId] ?? 0 },
  ].filter(shot => shot.damage > 0);
  return (
    <div className="battle-effects" style={timing} aria-hidden="true">
      {shots.map(shot => (
        <div key={shot.from} className={`battle-shot from-${shot.from}`} data-testid={`shot-${shot.from}`}>
          <img className="battle-packet" src={`${EFFECTS}data-packet.png`} alt="" />
          <img className="battle-burst" src={`${EFFECTS}data-burst.png`} alt="" />
          <span className="battle-damage">-{shot.damage}</span>
        </div>
      ))}
    </div>
  );
}
