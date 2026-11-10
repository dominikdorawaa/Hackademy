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
import { animatedRound, choreography, finisher, IMPACT_MS, impactAt, LOW_HP, MAX_HP, missChoreography, strikeChoreography, strikeRound, withoutStrike } from './battleView';
import type { Fighter } from './battleView';
import type { GameSession } from '../../../types/api';
import { formatElo } from '../../../lib/units';

function Plate({ fighter, side, hp, quickChat }: { fighter: Fighter; side: 'me' | 'rival'; hp: number; quickChat?: { onPick: (id: string) => void; notice: string | null } }) {
  const percent = Math.round((hp / MAX_HP) * 100);
  const avatar = <UserAvatar className="battle-plate-avatar" username={fighter.username} avatar={fighter.avatar} alt="" />;
  return (
    <div className={`battle-plate is-${side}`}>
      {quickChat ? <QuickChatMenu onPick={quickChat.onPick} notice={quickChat.notice}>{avatar}</QuickChatMenu> : avatar}
      <div className="battle-plate-info">
        <p className="battle-plate-name">{side === 'me' ? `${fighter.username} (Ty)` : fighter.username}</p>
        <p className="battle-plate-elo">{formatElo(fighter.elo)}</p>
        <div className="battle-hp" role="meter" aria-label={`HP: ${fighter.username}`} aria-valuemin={0} aria-valuemax={MAX_HP} aria-valuenow={hp} data-critical={hp > 0 && hp < LOW_HP}>
          <span className="battle-hp-trail" style={{ width: `${percent}%` }} />
          <span className="battle-hp-fill" style={{ width: `${percent}%` }} data-low={hp <= 40} />
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

export function BattleScene({ session: live, me, rival, reducedMotion, serverNow, quickChat, strike = null, miss = false, children }: {
  session: GameSession; me: Fighter; rival: Fighter; reducedMotion: boolean; serverNow: number;
  quickChat?: { onPick: (id: string) => void; notice: string | null }; strike?: number | null; miss?: boolean; children: ReactNode;
}) {
  const meAtlas = useAvatarAtlas(me.look);
  const rivalAtlas = useAvatarAtlas(rival.look);
  const ready = Boolean(meAtlas && rivalAtlas);
  const strikeKey = `${live.id}-${live.round}`;
  const rivalReady = live.status === 'ACTIVE' && live.phase === 'QUESTION' && live.answeredBy.includes(rival.id);
  const canStrike = strike !== null && strike > 0 && strike < rival.hp && live.status === 'ACTIVE' && live.phase === 'QUESTION';
  const [started, setStarted] = useState<string | null>(null);
  if (canStrike && !rivalReady && started !== strikeKey) setStarted(strikeKey);
  const striking = canStrike && (!rivalReady || started === strikeKey);
  const [struck, setStruck] = useState<string | null>(null);
  useEffect(() => {
    if (!striking) return;
    const timer = setTimeout(() => setStruck(strikeKey), ready && !reducedMotion ? IMPACT_MS : 0);
    return () => clearTimeout(timer);
  }, [striking, strikeKey, ready, reducedMotion]);
  const missing = miss && !striking && live.status === 'ACTIVE' && live.phase === 'QUESTION';
  const session = struck === strikeKey && live.lastRound?.round === live.round ? withoutStrike(live, rival.id) : live;
  const exchange = striking ? strikeRound(session, me.id, rival.id, strike) : animatedRound(session);
  const motionKey = `${session.id}-${session.round}-${session.phase}-${session.status}${striking ? '-strike' : missing ? '-miss' : ''}`;
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
  const hp = (fighter: Fighter) => {
    const damage = exchange?.damage[fighter.id] ?? 0;
    const before = striking ? fighter.hp : Math.min(MAX_HP, fighter.hp + damage);
    const after = striking ? fighter.hp - damage : fighter.hp;
    return animate && !(landed.key === motionKey && landed.ids.includes(fighter.id)) ? before : after;
  };
  const segments = (fighter: Fighter, opponent: Fighter) => striking ? strikeChoreography(fighter.id === me.id)
    : missing ? (fighter.id === me.id ? missChoreography() : choreography(session, fighter.id, opponent.id))
    : choreography(session, fighter.id, opponent.id);
  const hit = (fighter: Fighter) => animate && landed.key === motionKey && landed.ids.includes(fighter.id)
    && (exchange?.damage[fighter.id] ?? 0) > 0 && !finishedBy(fighter);
  const finishedBy = (fighter: Fighter) => finish && animate && finish.loserId === fighter.id ? finish : null;
  const meReaction = shownReaction(session, me.id, serverNow), rivalReaction = shownReaction(session, rival.id, serverNow);
  const announced = [meReaction && `Ty: ${meReaction.reaction.name}`, rivalReaction && `${rival.username}: ${rivalReaction.reaction.name}`].filter(Boolean).join('. ');

  return <>
    <header className="battle-hud">
      <Plate fighter={me} side="me" hp={hp(me)} quickChat={quickChat} />
      {children}
      <Plate fighter={rival} side="rival" hp={hp(rival)} />
    </header>
    <section className="battle-stage" aria-label="Arena walki" aria-busy={!ready} data-impact={hit(me) || hit(rival) || undefined}>
      {meAtlas && rivalAtlas ? <>
        <BattleReferee session={session} meId={me.id} serverNow={serverNow} reducedMotion={reducedMotion} finish={finish}
          remark={missing ? { key: `miss-${strikeKey}`, text: 'Pudło!', toward: 'me', tone: 'miss' } : rivalReady ? { key: `ready-${strikeKey}`, text: 'Rywal gotowy!', toward: 'me', tone: 'ready' } : null} />
        <BattleFighter key={`me-${motionKey}`} look={me.look} atlas={meAtlas} segments={segments(me, rival)} reducedMotion={reducedMotion}
          label={`Twój awatar, ${me.username}`} side="me" motionKey={motionKey} finishedBy={finishedBy(me)} reaction={reactionDance(meReaction)} hit={hit(me)} />
        <BattleFighter key={`rival-${motionKey}`} look={rival.look} atlas={rivalAtlas} segments={segments(rival, me)} reducedMotion={reducedMotion}
          label={`Awatar rywala, ${rival.username}`} side="rival" motionKey={motionKey} finishedBy={finishedBy(rival)} reaction={reactionDance(rivalReaction)}
          hit={hit(rival)} ready={rivalReady} />
        <EmoteBubble side="me" shown={meReaction} still={reducedMotion} />
        <EmoteBubble side="rival" shown={rivalReaction} still={reducedMotion} />
        {!reducedMotion && <BattleEffects key={motionKey} round={exchange} meId={me.id} rivalId={rival.id} finish={finish} />}
      </> : <ArenaLoader label="Przygotowuję postacie" avatar={me.avatar} className="battle-stage-loading" />}
      <p className="sr-only" role="status" aria-live="polite">{announced}</p>
    </section>
  </>;
}
