import { useState } from 'react';
import { AvatarSprite } from './arena/avatar/AvatarSprite';
import { AVATAR_ATLASES } from './arena/avatar/fighters';
import { useAvatarAtlas } from './arena/avatar/useAvatarAtlas';
import type { Avatar } from './arena/avatar/avatarModel';
import './LandingDuel.css';

const idle = (count: number) => Array<number>(count).fill(0);
const row = (index: number, count = 8) => Array.from({ length: count }, (_, column) => index * 9 + column + 1);

export const DUEL_FIGHTERS: { side: 'me' | 'rival'; label: string; look: Avatar; frames: number[] }[] = [
  {
    side: 'me', label: 'Twój awatar wyprowadza cios',
    look: { outfit: 'bluza', hair: 'krotkie', hat: 'brak', colors: { hair: 'brazowe', skin: 'jasna', top: 'granatowy', bottom: 'grafitowy', shoes: 'bialy', hat: 'czerwony' } },
    frames: [...idle(10), ...row(1), ...idle(6)],
  },
  {
    side: 'rival', label: 'Awatar rywala przyjmuje cios',
    look: { outfit: 'dres', hair: 'kucyk', hat: 'brak', colors: { hair: 'rude', skin: 'oliwkowa', top: 'bordowy', bottom: 'granatowy', shoes: 'bialy', hat: 'czerwony' } },
    frames: [...idle(15), ...row(4, 4), ...idle(5)],
  },
];

const prefersStill = () => document.documentElement.dataset.reducedMotion === 'true'
  || (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

function DuelFighter({ fighter, still }: { fighter: typeof DUEL_FIGHTERS[number]; still: boolean }) {
  const atlas = useAvatarAtlas(fighter.look);
  return (
    <div className={`landing-fighter is-${fighter.side}`} data-ready={Boolean(atlas)}>
      {atlas && <AvatarSprite atlas={atlas.atlas} atlasHeight={AVATAR_ATLASES[fighter.look.outfit].atlasHeight}
        frames={fighter.frames} frameTime={110} reducedMotion={still} label={fighter.label} />}
    </div>
  );
}

export default function LandingDuel() {
  const [still] = useState(prefersStill);
  return (
    <div className="landing-duel">
      <DuelFighter fighter={DUEL_FIGHTERS[0]} still={still} />
      <div className="vs-icon">VS</div>
      <DuelFighter fighter={DUEL_FIGHTERS[1]} still={still} />
    </div>
  );
}
