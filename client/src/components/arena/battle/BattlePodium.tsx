import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { AvatarSprite } from '../avatar/AvatarSprite';
import { AVATAR_ATLASES, KNOCKED_OUT, victoryDance } from '../avatar/fighters';
import { useAvatarAtlas } from '../avatar/useAvatarAtlas';
import { BattleResult } from './BattleResult';
import { PixelSprite } from '../../PixelSprite';
import { PODIUM_DANCES, PODIUM_EMOTES, podiumDance, podiumEmote, reactionLocked } from './quickChat';
import { useShop } from '../../../context/ShopContext';
import type { Fighter, Outcome } from './battleView';
import type { VictoryDance } from '../avatar/avatarModel';
import type { GameSession } from '../../../types/api';
import './BattlePodium.css';

const FRAME_MS = 110;
export const STANDING = 73;
export const FALL = [45, 46, 47, 48, 49, 50, 51, 52, KNOCKED_OUT];
export const FALL_DELAY_MS = 1600;
const FALL_FRAME_MS = 120;
export const ARRIVE_AT_MS = 3400;
export const ARRIVE_MS = 3200;
export const GRAB_MS = 400;
export const DRAG_MS = 4200;
export type LoserPhase = 'stand' | 'fall' | 'down' | 'arrive' | 'grab' | 'drag';
const PHASES: [LoserPhase, number][] = [
  ['fall', FALL_DELAY_MS], ['down', FALL_DELAY_MS + FALL.length * FALL_FRAME_MS], ['arrive', ARRIVE_AT_MS],
  ['grab', ARRIVE_AT_MS + ARRIVE_MS], ['drag', ARRIVE_AT_MS + ARRIVE_MS + GRAB_MS],
];

function useLoserPhase(still: boolean) {
  const [phase, setPhase] = useState<LoserPhase>(still ? 'down' : 'stand');
  useEffect(() => {
    if (still) return;
    const timers = PHASES.map(([next, at]) => setTimeout(() => setPhase(next), at));
    return () => timers.forEach(clearTimeout);
  }, [still]);
  return still ? 'down' : phase;
}

function Dancer({ fighter, still, dance, intro }: { fighter: Fighter; still: boolean; dance: VictoryDance; intro: boolean }) {
  const atlas = useAvatarAtlas(fighter.look);
  const { turn, loop } = victoryDance(dance);
  const [turned, setTurned] = useState(still || !intro || turn.length === 0);
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

function Loser({ fighter, phase, still }: { fighter: Fighter; phase: LoserPhase; still: boolean }) {
  const atlas = useAvatarAtlas(fighter.look);
  if (!atlas) return null;
  const source = AVATAR_ATLASES[fighter.look.outfit];
  const frames = phase === 'stand' ? [0] : phase === 'fall' ? FALL : phase === 'drag' || phase === 'grab' ? [source.dragged] : [KNOCKED_OUT];
  return <AvatarSprite key={phase === 'fall' ? 'fall' : frames.join()} atlas={atlas.atlas} atlasHeight={source.atlasHeight}
    frames={frames} loop={false} frameTime={FALL_FRAME_MS} reducedMotion={still} label={`${fighter.username} przegrywa`} />;
}

function Emote({ session, fighter, serverNow, still }: { session?: GameSession; fighter: Fighter; serverNow: number; still: boolean }) {
  const shown = session ? podiumEmote(session, fighter.id, serverNow) : null;
  const sprite = shown?.reaction.sprite;
  if (!shown || !sprite) return null;
  return <p key={shown.key} className="battle-podium-emote" data-reaction={shown.reaction.id} role="img" aria-label={`${fighter.username}: ${shown.reaction.name}`}>
    <PixelSprite sprite={sprite} scale={2} duration={sprite.frames * 110} still={still} />
  </p>;
}

function Controls({ dance, canDance, onReact, notice }: { dance: VictoryDance | null; canDance: boolean; onReact: (id: string) => void; notice: string | null }) {
  const { shop } = useShop();
  return (
    <div className="battle-podium-controls">
      {canDance && <div className="battle-podium-choice" role="group" aria-label="Twój taniec">
        <span aria-hidden="true">Taniec</span>
        {PODIUM_DANCES.map(option => {
          const locked = reactionLocked(shop, option.id);
          return <button key={option.id} type="button" aria-pressed={dance === option.dance} disabled={locked} title={locked ? 'Kupisz w Sklepie' : undefined}
            onClick={() => onReact(option.id)}>{option.name}{locked && <span className="sr-only">, do kupienia w Sklepie</span>}</button>;
        })}
      </div>}
      <div className="battle-podium-choice" role="group" aria-label="Szybki czat">
        <span aria-hidden="true">Czat</span>
        {PODIUM_EMOTES.filter(option => !reactionLocked(shop, option.id)).map(option => <button key={option.id} type="button" onClick={() => onReact(option.id)}>{option.text}</button>)}
      </div>
      {notice && <p className="battle-podium-notice" role="status">{notice}</p>}
    </div>
  );
}

function NameTag({ fighter, mine }: { fighter: Fighter; mine: boolean }) {
  return <p className="battle-podium-name">{fighter.username}{mine && <span>Ty</span>}</p>;
}

export function BattlePodium({ me, rival, result, title, change, still, session, serverNow = 0, onReact, notice = null }: {
  me: Fighter; rival: Fighter; result: Exclude<Outcome, 'cancelled'>; title: string; change: number; still: boolean;
  session?: GameSession; serverNow?: number; onReact?: (id: string) => void; notice?: string | null;
}) {
  const winner = result === 'win' ? me : result === 'loss' ? rival : null;
  const loser = result === 'win' ? rival : result === 'loss' ? me : null;
  const phase = useLoserPhase(still);
  const chosen = (fighter: Fighter) => session ? podiumDance(session, fighter.id) : null;
  const dancer = (fighter: Fighter) => {
    const picked = chosen(fighter);
    return <Dancer key={picked ?? 'own'} fighter={fighter} still={still} dance={picked ?? fighter.look.dance} intro={!picked} />;
  };
  const emote = (fighter: Fighter) => <Emote session={session} fighter={fighter} serverNow={serverNow} still={still} />;
  return (
    <div className="battle-podium" data-result={result} data-still={still || undefined}>
      <div className="battle-podium-backdrop" aria-hidden="true" />
      <div className="battle-podium-beams" aria-hidden="true"><span /><span /></div>
      <BattleResult result={result} title={title} change={change} still={still} />
      <div className="battle-podium-stage">
        {winner && loser ? <>
          <figure className="battle-podium-loser" data-phase={phase} style={{ '--drag-ms': `${DRAG_MS}ms`, '--arrive-ms': `${ARRIVE_MS}ms` } as CSSProperties}>
            <div className="battle-podium-sprite">
              <Loser fighter={loser} phase={phase} still={still} />
              {emote(loser)}
              {(phase === 'arrive' || phase === 'grab' || phase === 'drag') && <span className="battle-podium-bit" role="img" aria-label="Bit wyciąga przegranego z areny" />}
            </div>
            <figcaption><NameTag fighter={loser} mine={loser.id === me.id} /></figcaption>
          </figure>
          <figure className="battle-podium-winner">
            <div className="battle-podium-sprite">{dancer(winner)}{emote(winner)}</div>
            <figcaption><NameTag fighter={winner} mine={winner.id === me.id} /></figcaption>
          </figure>
        </> : [me, rival].map(fighter => (
          <figure key={fighter.id} className="battle-podium-tie">
            <div className="battle-podium-sprite">
              {chosen(fighter) ? dancer(fighter) : <Pose fighter={fighter} frames={[STANDING]} frameTime={FRAME_MS} still={still} label={fighter.username} />}
              {emote(fighter)}
            </div>
            <figcaption><NameTag fighter={fighter} mine={fighter.id === me.id} /></figcaption>
          </figure>
        ))}
      </div>
      {onReact && <Controls dance={winner ? (winner.id === me.id ? chosen(me) ?? me.look.dance : null) : chosen(me)} canDance={!winner || winner.id === me.id} onReact={onReact} notice={notice} />}
    </div>
  );
}
