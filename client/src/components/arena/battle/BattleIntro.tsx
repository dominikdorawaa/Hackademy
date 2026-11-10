import type { CSSProperties } from 'react';
import { Check, Minus, X } from 'lucide-react';
import { AvatarSprite, KNEE_ROW } from '../avatar/AvatarSprite';
import { AVATAR_ATLASES } from '../avatar/fighters';
import { useAvatarAtlas } from '../avatar/useAvatarAtlas';
import { LeagueIcon } from '../LeagueIcon';
import { leagueFor } from '../leagues';
import { PixelSprite, SPRITES } from '../../PixelSprite';
import { ArenaRunner } from '../ArenaLoader';
import { formatNumberPL } from '../../../lib/units';
import type { ArenaIntroCard, AvatarConfig } from '../../../types/api';
import type { Fighter } from './battleView';
import './BattleIntro.css';

const RECENT = 5;
const RESULT_LABEL = { WIN: 'wygrana', LOSS: 'porażka', DRAW: 'remis' } as const;

function Recent({ results }: { results: ArenaIntroCard['recent'] }) {
  const slots = Array.from({ length: RECENT }, (_, index) => results[index] ?? null);
  return (
    <ol className="battle-intro-recent" aria-label={results.length ? `Ostatnie walki: ${results.map(result => RESULT_LABEL[result]).join(', ')}` : 'Brak rozegranych walk'}>
      {slots.map((result, index) => (
        <li key={index} data-result={result ?? 'none'} aria-hidden="true">
          {result === 'WIN' ? <Check /> : result === 'LOSS' ? <X /> : result === 'DRAW' ? <Minus /> : null}
        </li>
      ))}
    </ol>
  );
}

function Card({ fighter, side, card }: { fighter: Fighter; side: 'me' | 'rival'; card: ArenaIntroCard | null }) {
  const { league } = leagueFor(fighter.elo);
  const games = card?.games ?? 0;
  const rate = card && games > 0 ? `${Math.round((card.wins / games) * 100)}%` : '–';
  return (
    <section className={`battle-intro-card is-${side}`} aria-label={side === 'me' ? `Ty, ${fighter.username}` : `Rywal, ${fighter.username}`}>
      <header className="battle-intro-head">
        <h2>{fighter.username}</h2>
        {side === 'me' && <span className="battle-intro-you">Ty</span>}
      </header>
      <p className="battle-intro-league" style={{ '--league': league.color } as CSSProperties}>
        <LeagueIcon league={league} className="battle-intro-league-icon" />{league.name}
      </p>
      <dl className="battle-intro-stats">
        <div><dt>Elo</dt><dd>{formatNumberPL(fighter.elo)}</dd></div>
        <div><dt>Ranking</dt><dd>{card?.rank ? `#${formatNumberPL(card.rank)}` : '–'}</dd></div>
        <div><dt>Walki</dt><dd>{formatNumberPL(games)}</dd></div>
        <div><dt>Wygrane</dt><dd>{rate}</dd></div>
      </dl>
      <div className="battle-intro-history">
        {games > 0 ? <Recent results={card?.recent ?? []} /> : <p className="battle-intro-debut">Debiut na arenie</p>}
        <p className="battle-intro-caption">
          {card && card.streak > 1
            ? <><PixelSprite sprite={SPRITES.flame} className="battle-intro-flame" />Seria wygranych: {card.streak}</>
            : 'Ostatnie walki'}
        </p>
      </div>
    </section>
  );
}

function Contender({ fighter, side, card, reducedMotion }: { fighter: Fighter; side: 'me' | 'rival'; card: ArenaIntroCard | null; reducedMotion: boolean }) {
  const atlas = useAvatarAtlas(fighter.look);
  return (
    <div className={`battle-intro-side is-${side}`}>
      <div className="battle-intro-fighter" aria-hidden="true">
        {atlas && <AvatarSprite atlas={atlas.atlas} atlasHeight={AVATAR_ATLASES[fighter.look.outfit].atlasHeight} frames={[0]}
          reducedMotion={reducedMotion} knee={KNEE_ROW} label={fighter.username} />}
      </div>
      <Card fighter={fighter} side={side} card={card} />
    </div>
  );
}

export function BattleIntro({ me, rival, cards, secondsLeft, totalRounds, roundSeconds, leaving, reducedMotion }: {
  me: Fighter; rival: Fighter; cards: Record<string, ArenaIntroCard> | undefined; secondsLeft: number; totalRounds: number;
  roundSeconds: number; leaving: boolean; reducedMotion: boolean;
}) {
  const counting = secondsLeft > 0 && secondsLeft <= 3;
  return (
    <div className="battle-intro" data-leaving={leaving || undefined} data-still={reducedMotion || undefined} role="dialog" aria-modal="false" aria-labelledby="battle-intro-title">
      <div className="battle-intro-backdrop" aria-hidden="true" />
      <div className="battle-intro-split" aria-hidden="true" />
      <header className="battle-intro-top">
        <p id="battle-intro-title" className="battle-intro-title">Pojedynek</p>
        <p className="battle-intro-rules">{totalRounds} rund · {roundSeconds} s na odpowiedź</p>
      </header>
      <Contender fighter={me} side="me" card={cards?.[me.id] ?? null} reducedMotion={reducedMotion} />
      <div className="battle-intro-center">
        <p className="battle-intro-vs" aria-hidden="true">VS</p>
        <p key={counting ? secondsLeft : 'wait'} className="battle-intro-count" role="timer" aria-label="Walka zaczyna się za" data-counting={counting || undefined}>
          {leaving ? 'Walka!' : secondsLeft}
        </p>
      </div>
      <Contender fighter={rival} side="rival" card={cards?.[rival.id] ?? null} reducedMotion={reducedMotion} />
      <div className="battle-intro-flash" aria-hidden="true" />
    </div>
  );
}

export function BattleIntroLoading({ label, avatar }: { label: string; avatar?: AvatarConfig | null }) {
  return (
    <div className="battle-intro is-loading" role="status" aria-label={label}>
      <div className="battle-intro-backdrop" aria-hidden="true" />
      <div className="battle-intro-split" aria-hidden="true" />
      <div className="battle-intro-loader">
        <ArenaRunner avatar={avatar} />
        <p className="battle-intro-loading-text" aria-hidden="true">Wczytuję walkę<span>.</span><span>.</span><span>.</span></p>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
