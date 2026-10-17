import type { CSSProperties } from 'react';
import { FINISHER_FRAME_MS, FINISHERS, IMPACT_MS, LAUNCH_MS } from './battleView';
import type { Finisher } from './battleView';
import type { RoundResult } from '../../../types/api';

const EFFECTS = '/assets/arena/effects/';

function FinisherEffects({ finish, from, damage }: { finish: Finisher; from: 'me' | 'rival'; damage: number }) {
  const timing = { '--finish-start': `${finish.start}ms`, '--finish-impact': `${finish.impact}ms`, '--finish-end': `${finish.end}ms` } as CSSProperties;
  const hits = FINISHERS[finish.move].hits.map(hit => finish.start + hit * FINISHER_FRAME_MS);
  return (
    <div className={`battle-shot battle-finisher from-${from} is-${finish.move}`} style={timing} data-testid={`finisher-${finish.move}`}>
      <div className="battle-finish-dim" />
      {finish.move === 'beam' ? <>
        <img className="battle-finish-orb" src={`${EFFECTS}finisher-orb.png`} alt="" />
        <img className="battle-finish-beam" src={`${EFFECTS}finisher-beam.png`} alt="" />
      </> : hits.map(ms => <img key={ms} className="battle-finish-hit" style={{ '--hit': `${ms}ms` } as CSSProperties} src={`${EFFECTS}data-burst.png`} alt="" />)}
      <img className="battle-finish-blast" src={`${EFFECTS}finisher-blast.png`} alt="" />
      <span className="battle-damage battle-finish-damage">-{damage}</span>
      <p className="battle-finish-banner"><span>Cios kończący</span><strong>{FINISHERS[finish.move].name}</strong></p>
    </div>
  );
}

export function BattleEffects({ round, meId, rivalId, finish = null }: { round: RoundResult | null; meId: number; rivalId: number; finish?: Finisher | null }) {
  if (!round) return null;
  const timing = { '--launch': `${LAUNCH_MS}ms`, '--impact': `${IMPACT_MS}ms` } as CSSProperties;
  const finisherSide = finish ? (finish.winnerId === meId ? 'me' : 'rival') : null;
  const shots = [
    { from: 'me' as const, damage: round.damage[rivalId] ?? 0 },
    { from: 'rival' as const, damage: round.damage[meId] ?? 0 },
  ].filter(shot => shot.damage > 0);
  return (
    <div className="battle-effects" style={timing} aria-hidden="true">
      {shots.map(shot => finish && shot.from === finisherSide ? <FinisherEffects key={shot.from} finish={finish} from={shot.from} damage={shot.damage} /> : (
        <div key={shot.from} className={`battle-shot from-${shot.from}`} data-testid={`shot-${shot.from}`}>
          <img className="battle-packet" src={`${EFFECTS}data-packet.png`} alt="" />
          <img className="battle-burst" src={`${EFFECTS}data-burst.png`} alt="" />
          <span className="battle-damage">-{shot.damage}</span>
        </div>
      ))}
    </div>
  );
}
