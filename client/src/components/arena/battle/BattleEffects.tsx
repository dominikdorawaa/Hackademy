import type { CSSProperties } from 'react';
import { IMPACT_MS, LAUNCH_MS } from './battleView';
import type { RoundResult } from '../../../types/api';

const FIRE = { o: '#d2420c', m: '#ffad4d', w: '#fff3cf' } as const;
const FIREBALL = [
  '......ooo..',
  '...oo.ommo.',
  '.o.oommwwmo',
  'oo.ommwwwwm',
  '.o.oommwwmo',
  '...oo.ommo.',
  '......ooo..',
];
const BURST = [
  'o...w...o',
  '.o..m..o.',
  '..mmwmm..',
  '..mwwwm..',
  'wmwwwwwmw',
  '..mwwwm..',
  '..mmwmm..',
  '.o..m..o.',
  'o...w...o',
];

function PixelArt({ pattern, className }: { pattern: readonly string[]; className: string }) {
  const rows = pattern.length;
  const cols = pattern[0].length;
  return (
    <svg className={className} viewBox={`0 0 ${cols} ${rows}`} shapeRendering="crispEdges" aria-hidden="true">
      {pattern.flatMap((line, row) => [...line].flatMap((key, col) => key in FIRE
        ? [<rect key={`${row}-${col}`} x={col} y={row} width={1.05} height={1.05} fill={FIRE[key as keyof typeof FIRE]} />]
        : []))}
    </svg>
  );
}

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
        <div key={shot.from} className={`battle-shot from-${shot.from}`} data-testid={`fireball-${shot.from}`}>
          <PixelArt pattern={FIREBALL} className="battle-fireball" />
          <PixelArt pattern={BURST} className="battle-burst" />
          <span className="battle-damage">-{shot.damage}</span>
        </div>
      ))}
    </div>
  );
}
