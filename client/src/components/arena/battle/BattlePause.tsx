import UserAvatar from '../../UserAvatar';
import { PAUSE_SECONDS } from './battleView';
import type { Fighter, PauseNotice, PauseSide } from './battleView';

function Player({ fighter, side, state }: { fighter: Fighter; side: 'me' | 'rival'; state: PauseSide }) {
  return (
    <li className={`battle-pause-player is-${side}`} data-away={state.status !== null}>
      <UserAvatar className="battle-pause-avatar" username={fighter.username} avatar={fighter.avatar} alt="" />
      <span className="battle-pause-name">{side === 'me' ? `${fighter.username} (Ty)` : fighter.username}</span>
      <span className="battle-pause-state">
        <span className="battle-pause-token" data-used={state.used} aria-hidden="true" />
        {state.used ? 'Pauza wykorzystana' : 'Pauza dostępna'}
      </span>
      {state.status && <span className="battle-pause-away">{state.status}</span>}
    </li>
  );
}

export function BattlePause({ pause, me, rival }: { pause: PauseNotice; me: Fighter; rival: Fighter }) {
  return (
    <section className="battle-card battle-pause" data-cause={pause.cause} aria-labelledby="battle-pause-title">
      <div className="battle-pause-head">
        <div>
          <h1 id="battle-pause-title" className="battle-pause-title">Walka wstrzymana</h1>
          <p className="battle-pause-reason" role="status">{pause.reason}</p>
        </div>
        <p className="battle-pause-count" role="timer" aria-label="Wznowienie najpóźniej za">
          {pause.secondsLeft}<span> s</span>
        </p>
      </div>
      <div className="battle-pause-meter" aria-hidden="true">
        {Array.from({ length: PAUSE_SECONDS }, (_, index) => <span key={index} data-on={index < pause.secondsLeft} />)}
      </div>
      <ul className="battle-pause-players" aria-label="Pauzy graczy">
        <Player fighter={me} side="me" state={pause.me} />
        <Player fighter={rival} side="rival" state={pause.rival} />
      </ul>
      <p className="battle-pause-note">Każdy gracz ma jedną pauzę na mecz. Czas rundy stoi, a pytanie wróci po wznowieniu.</p>
    </section>
  );
}
