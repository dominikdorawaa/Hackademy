import { useEffect, useState } from 'react';
import { AvatarSprite } from '../avatar/AvatarSprite';
import { AVATAR_ATLASES, victoryDance } from '../avatar/fighters';
import { useAvatarAtlas } from '../avatar/useAvatarAtlas';
import { BattleResult } from './BattleResult';
import type { Fighter, Outcome } from './battleView';
import './BattlePodium.css';

const FRAME_MS = 110;
export const STANDING = 73;
export const FALL = [45, 46, 47, 48, 49, 50, 51, 52, 53];
export const FALL_DELAY_MS = 1600;
const FALL_FRAME_MS = 120;

function Dancer({ fighter, still }: { fighter: Fighter; still: boolean }) {
  const atlas = useAvatarAtlas(fighter.look);
  const { turn, loop } = victoryDance(fighter.look.dance);
  const [turned, setTurned] = useState(still || turn.length === 0);
  useEffect(() => {
    if (turned) return;
    const timer = setTimeout(() => setTurned(true), turn.length * FRAME_MS);
    return () => clearTimeout(timer);
  }, [turned, turn.length]);
  if (!atlas) return null;
  return <AvatarSprite key={turned ? 'dance' : 'turn'} atlas={atlas.atlas} atlasHeight={AVATAR_ATLASES[fighter.look.outfit].atlasHeight}
    frames={turned ? loop : turn} loop={turned} frameTime={FRAME_MS} reducedMotion={still} label={`${fighter.username} tańczy`} />;
}

function Pose({ fighter, frames, frameTime, still, label }: { fighter: Fighter; frames: number[]; frameTime: number; still: boolean; label: string }) {
  const atlas = useAvatarAtlas(fighter.look);
  if (!atlas) return null;
  return <AvatarSprite atlas={atlas.atlas} atlasHeight={AVATAR_ATLASES[fighter.look.outfit].atlasHeight}
    frames={frames} frameTime={frameTime} reducedMotion={still} label={label} />;
}

function Fallen({ fighter, still }: { fighter: Fighter; still: boolean }) {
  const atlas = useAvatarAtlas(fighter.look);
  const [falling, setFalling] = useState(still);
  useEffect(() => {
    if (falling) return;
    const timer = setTimeout(() => setFalling(true), FALL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [falling]);
  if (!atlas) return null;
  return <AvatarSprite key={falling ? 'fall' : 'stand'} atlas={atlas.atlas} atlasHeight={AVATAR_ATLASES[fighter.look.outfit].atlasHeight}
    frames={falling ? FALL : [0]} loop={false} frameTime={FALL_FRAME_MS} reducedMotion={still} label={`${fighter.username} przegrywa`} />;
}

function NameTag({ fighter, mine }: { fighter: Fighter; mine: boolean }) {
  return <p className="battle-podium-name">{fighter.username}{mine && <span>Ty</span>}</p>;
}

export function BattlePodium({ me, rival, result, title, change, still }: {
  me: Fighter; rival: Fighter; result: Exclude<Outcome, 'cancelled'>; title: string; change: number; still: boolean;
}) {
  const winner = result === 'win' ? me : result === 'loss' ? rival : null;
  const loser = result === 'win' ? rival : result === 'loss' ? me : null;
  return (
    <div className="battle-podium" data-result={result} data-still={still || undefined}>
      <div className="battle-podium-backdrop" aria-hidden="true" />
      <div className="battle-podium-beams" aria-hidden="true"><span /><span /></div>
      <BattleResult result={result} title={title} change={change} still={still} />
      <div className="battle-podium-stage">
        {winner && loser ? <>
          <figure className="battle-podium-loser">
            <div className="battle-podium-sprite">
              <Fallen fighter={loser} still={still} />
            </div>
            <figcaption><NameTag fighter={loser} mine={loser.id === me.id} /></figcaption>
          </figure>
          <figure className="battle-podium-winner">
            <div className="battle-podium-sprite"><Dancer fighter={winner} still={still} /></div>
            <figcaption><NameTag fighter={winner} mine={winner.id === me.id} /></figcaption>
          </figure>
        </> : [me, rival].map(fighter => (
          <figure key={fighter.id} className="battle-podium-tie">
            <div className="battle-podium-sprite">
              <Pose fighter={fighter} frames={[STANDING]} frameTime={FRAME_MS} still={still} label={fighter.username} />
            </div>
            <figcaption><NameTag fighter={fighter} mine={fighter.id === me.id} /></figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
