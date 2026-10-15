import { useEffect, useId, useRef, useState } from 'react';
import { playBattle } from './battleAnimation';
import type { BattleResult, BattleSide } from './battleAnimation';
import './BattleScene.css';

export interface BattleFighter { name: string; avatarSeed: string; hp: number }
interface Props {
  left: BattleFighter; right: BattleFighter; result: BattleResult | null; reducedMotion: boolean;
  onImpact: (result: BattleResult) => void; onComplete: () => void;
}

function Fighter({ side, fighter }: { side: BattleSide; fighter: BattleFighter }) {
  const [failedSeed, setFailedSeed] = useState<string | null>(null);
  const avatar = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(fighter.avatarSeed)}&backgroundColor=transparent`;
  return <svg x={side === 'left' ? 110 : 530} y="70" width="160" height="200" viewBox="0 0 128 160" aria-hidden="true" data-fighter={side}>
    <g transform={side === 'right' ? 'translate(128 0) scale(-1 1)' : undefined}>
      <g data-part="recoil">
        <g className="battle-leg-back"><path d="M42 102h20v38H42z" fill="#273b55" /><path d="M36 136h28v10H36z" fill="#121c2d" /></g>
        <g data-part="leg"><path d="M66 102h20v38H66z" fill="#344b68" /><path d="M66 136h30v10H66z" fill="#17243a" /><path d="M68 130h16v6H68z" className="battle-suit-accent" /></g>
        <g data-part="body">
          <g className="battle-breath">
            <path d="M34 62h16v38H34z" fill="#283d58" /><path d="M32 92h20v12H32z" className="battle-suit-accent" />
            <path d="M42 54h42v8h8v38h-6v12H40v-12h-6V62h8z" fill="#24364d" />
            <path d="M48 58h28v8H48zM42 70h42v24H42z" fill="#3b526f" />
            <path d="M48 72h30v6H48zM48 84h18v6H48z" className="battle-suit-accent" />
            <path d="M40 100h46v10H40z" fill="#101c2c" /><path d="M60 100h10v8H60z" fill="#d6e4f3" />
            <svg x="32" y="6" width="64" height="48" viewBox="0 0 16 12" overflow="hidden">
              {failedSeed === fighter.avatarSeed ? <g><path d="M4 2h8v1h1v7h-1v2H4v-2H3V3h1z" fill="#c98e6c" /><path d="M3 2h10v3H3zM5 6h2v2H5zM10 6h2v2h-2z" fill="#22344b" /><path d="M6 10h4v1H6z" fill="#6d3841" /></g>
                : <image href={avatar} width="16" height="16" onError={() => setFailedSeed(fighter.avatarSeed)} />}
            </svg>
            <g data-part="arm"><path d="M80 62h16v26H80z" fill="#4a6380" /><path d="M82 84h16v22H82z" fill="#293f59" /><path d="M78 94h24v18H78z" className="battle-suit-accent" /><path d="M82 98h16v6H82z" fill="#e4f5ff" /></g>
          </g>
        </g>
      </g>
    </g>
  </svg>;
}

export default function BattleScene({ left, right, result, reducedMotion, onImpact, onComplete }: Props) {
  const scene = useRef<SVGSVGElement>(null);
  const seen = useRef(new Set<string>());
  const callbacks = useRef({ onImpact, onComplete, reducedMotion });
  const titleId = useId();
  const id = result?.id, kind = result?.kind, attacker = result?.attacker;
  useEffect(() => { callbacks.current = { onImpact, onComplete, reducedMotion }; }, [onImpact, onComplete, reducedMotion]);
  useEffect(() => {
    if (!id || !kind || !attacker || seen.current.has(id)) return;
    const event = { id, kind, attacker };
    let cancel: (() => void) | undefined;
    const start = setTimeout(() => {
      seen.current.add(id);
      cancel = playBattle(scene.current!, event, callbacks.current.reducedMotion,
        () => callbacks.current.onImpact(event), () => callbacks.current.onComplete());
    }, 0);
    return () => { clearTimeout(start); cancel?.(); };
  }, [id, kind, attacker]);
  const impactX = kind === 'clash' ? 400 : attacker === 'left' ? 570 : 230;
  return <div className="battle-scene" data-reduced-motion={reducedMotion}>
    <div className="battle-scoreboard">{([['left', left], ['right', right]] as const).map(([side, fighter]) =>
      <div key={side} className={`battle-score battle-score-${side}`}>
        <div><strong>{fighter.name}</strong><span>{fighter.hp}<small> / 100 HP</small></span></div>
        <div role="meter" aria-label={`HP: ${fighter.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={fighter.hp} className="battle-health"><span style={{ width: `${Math.max(0, Math.min(100, fighter.hp))}%` }} /></div>
      </div>)}
    </div>
    <svg ref={scene} viewBox="0 0 800 320" className="battle-stage" role="img" aria-labelledby={titleId}>
      <title id={titleId}>{`Pojedynek: ${left.name} kontra ${right.name}`}</title>
      <path d="M90 270h620M122 282h110m336 0h110" className="battle-ground" />
      <path d="M48 236v-18h18M752 236v-18h-18M48 72V54h18M752 72V54h-18" className="battle-stage-corners" />
      <ellipse cx="190" cy="267" rx="68" ry="7" className="battle-shadow" /><ellipse cx="610" cy="267" rx="68" ry="7" className="battle-shadow" />
      <Fighter side="left" fighter={left} /><Fighter side="right" fighter={right} />
      {(['left', 'right'] as const).map(side => <g key={side} className={`battle-energy battle-energy-${side}`}>
        <g transform={`translate(${side === 'left' ? 245 : 555} 176)`}><g data-charge={side}><path d="M-16-8h8v-8H8v8h8V8H8v8H-8V8h-8z" /></g>
          <g data-projectile={side}><path d={side === 'left' ? 'M-38-4h20v-5h14v-7H10v7h8V9h-8v7H-4V9h-14V4h-20z' : 'M38-4H18v-5H4v-7H-10v7h-8V9h8v7H4V9h14V4h20z'} /><path d="M-5-5H5V5H-5z" className="battle-energy-core" /></g>
        </g>
      </g>)}
      <g transform={`translate(${impactX} 176)`}><g data-impact><path d="M-4-36h8v24l16-16 8 8-16 16h24v8H12l16 16-8 8L4 12v24h-8V12l-16 16-8-8 16-16h-24v-8h24l-16-16 8-8L-4-12z" /></g></g>
      <g transform={`translate(${impactX} 108)`}><text data-damage textAnchor="middle">−20</text></g>
    </svg>
  </div>;
}
