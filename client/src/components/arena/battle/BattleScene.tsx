import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import UserAvatar from '../../UserAvatar';
import { useAvatarAtlas } from '../avatar/useAvatarAtlas';
import { BattleEffects } from './BattleEffects';
import { BattleFighter } from './BattleFighter';
import { BattleReferee } from './BattleReferee';
import { QuickChatMenu } from './QuickChatMenu';
import { PixelSprite } from '../../PixelSprite';
import { ArenaLoader } from '../ArenaLoader';
import { reactionDance, shownReaction } from './quickChat';
import type { ShownReaction } from './quickChat';
import { animatedRound, choreography, finisher, impactAt, MAX_HP } from './battleView';
import type { Fighter } from './battleView';
import type { GameSession } from '../../../types/api';

function Plate({ fighter, side, hp, quickChat }: { fighter: Fighter; side: 'me' | 'rival'; hp: number; quickChat?: { onPick: (id: string) => void; notice: string | null } }) {
  const percent = Math.round((hp / MAX_HP) * 100);
  const avatar = <UserAvatar className="battle-plate-avatar" username={fighter.username} avatar={fighter.avatar} alt="" />;
  return (
    <div className={`battle-plate is-${side}`}>
      {quickChat ? <QuickChatMenu onPick={quickChat.onPick} notice={quickChat.notice}>{avatar}</QuickChatMenu> : avatar}
      <div className="battle-plate-info">
        <p className="battle-plate-name">{side === 'me' ? `${fighter.username} (Ty)` : fighter.username}</p>
        <p className="battle-plate-elo">Elo {fighter.elo}</p>
        <div className="battle-hp" role="meter" aria-label={`HP: ${fighter.username}`} aria-valuemin={0} aria-valuemax={MAX_HP} aria-valuenow={hp}>
          <span style={{ width: `${percent}%` }} data-low={hp <= 40} />
        </div>
        <p className="battle-plate-hp">{hp} HP</p>
      </div>
    </div>
  );
}

function EmoteBubble({ side, shown, still }: { side: 'me' | 'rival'; shown: ShownReaction | null; still: boolean }) {
  const sprite = shown?.reaction.sprite;
  if (!shown || !sprite) return null;
  return <p key={shown.key} className={`battle-reaction is-${side}`} aria-hidden="true" data-reaction={shown.reaction.id}>
    <PixelSprite sprite={sprite} scale={2} duration={sprite.frames * 110} still={still} />
  </p>;
}

export function BattleScene({ session, me, rival, reducedMotion, serverNow, quickChat, children }: {
  session: GameSession; me: Fighter; rival: Fighter; reducedMotion: boolean; serverNow: number;
  quickChat?: { onPick: (id: string) => void; notice: string | null }; children: ReactNode;
}) {
  const meAtlas = useAvatarAtlas(me.look);
  const rivalAtlas = useAvatarAtlas(rival.look);
  const ready = Boolean(meAtlas && rivalAtlas);
  const exchange = animatedRound(session);
  const motionKey = `${session.id}-${session.round}-${session.phase}-${session.status}`;
  const finish = finisher(session);
  const [landed, setLanded] = useState<{ key: string; ids: number[] }>({ key: '', ids: [] });
  const animate = Boolean(exchange && !reducedMotion);
  const meImpact = impactAt(session, me.id), rivalImpact = impactAt(session, rival.id);
  useEffect(() => {
    if (!ready || !animate) return;
    const timers = ([[me.id, meImpact], [rival.id, rivalImpact]] as const).map(([id, ms]) => setTimeout(() => setLanded(previous => ({
      key: motionKey, ids: [...(previous.key === motionKey ? previous.ids : []), id],
    })), ms));
    return () => timers.forEach(clearTimeout);
  }, [ready, animate, motionKey, me.id, rival.id, meImpact, rivalImpact]);
  const hp = (fighter: Fighter) => animate && !(landed.key === motionKey && landed.ids.includes(fighter.id))
    ? Math.min(MAX_HP, fighter.hp + (exchange?.damage[fighter.id] ?? 0)) : fighter.hp;
  const finishedBy = (fighter: Fighter) => finish && animate && finish.loserId === fighter.id ? finish : null;
  const meReaction = shownReaction(session, me.id, serverNow), rivalReaction = shownReaction(session, rival.id, serverNow);
  const announced = [meReaction && `Ty: ${meReaction.reaction.name}`, rivalReaction && `${rival.username}: ${rivalReaction.reaction.name}`].filter(Boolean).join('. ');

  return <>
    <header className="battle-hud">
      <Plate fighter={me} side="me" hp={hp(me)} quickChat={quickChat} />
      {children}
      <Plate fighter={rival} side="rival" hp={hp(rival)} />
    </header>
    <section className="battle-stage" aria-label="Arena walki" aria-busy={!ready}>
      {meAtlas && rivalAtlas ? <>
        <BattleReferee session={session} meId={me.id} serverNow={serverNow} reducedMotion={reducedMotion} finish={finish} />
        <BattleFighter key={`me-${motionKey}`} look={me.look} atlas={meAtlas} segments={choreography(session, me.id, rival.id)} reducedMotion={reducedMotion}
          label={`Twój awatar, ${me.username}`} side="me" motionKey={motionKey} finishedBy={finishedBy(me)} reaction={reactionDance(meReaction)} />
        <BattleFighter key={`rival-${motionKey}`} look={rival.look} atlas={rivalAtlas} segments={choreography(session, rival.id, me.id)} reducedMotion={reducedMotion}
          label={`Awatar rywala, ${rival.username}`} side="rival" motionKey={motionKey} finishedBy={finishedBy(rival)} reaction={reactionDance(rivalReaction)} />
        <EmoteBubble side="me" shown={meReaction} still={reducedMotion} />
        <EmoteBubble side="rival" shown={rivalReaction} still={reducedMotion} />
        {!reducedMotion && <BattleEffects key={motionKey} round={exchange} meId={me.id} rivalId={rival.id} finish={finish} />}
      </> : <ArenaLoader label="Przygotowuję postacie" avatar={me.avatar} className="battle-stage-loading" />}
      <p className="sr-only" role="status" aria-live="polite">{announced}</p>
    </section>
  </>;
}
