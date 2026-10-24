import type { ReactNode } from 'react';
import UserAvatar from './UserAvatar';
import type { AvatarConfig } from '../types/api';
import './InvitationCard.css';

export type InvitationKind = 'friend' | 'challenge';

function Fighter({ name, avatar, elo, label, own }: { name: string; avatar?: AvatarConfig | null; elo?: number | null; label: string; own?: boolean }) {
  return <span className="invite-fighter">
    <UserAvatar className={own ? 'invite-portrait invite-portrait-own' : 'invite-portrait'} username={name} avatar={avatar} alt="" />
    {elo != null && <span className="invite-elo" aria-label={`${label}: ${elo}`}><b>{elo}</b> Elo</span>}
  </span>;
}

/** The face of an incoming invitation: the sender's pixel portrait and an answer, shared by the live toast and the settings preview. */
export default function InvitationCard({ kind, actor, avatar, elo, ownName, ownAvatar, ownElo, busy, failed, onAccept, onReject, children }: {
  kind: InvitationKind; actor: string; avatar?: AvatarConfig | null; elo?: number | null; ownName?: string; ownAvatar?: AvatarConfig | null; ownElo?: number | null;
  busy?: boolean; failed?: boolean; onAccept?: () => void; onReject?: () => void; children?: ReactNode;
}) {
  const challenge = kind === 'challenge';
  return <div className="invite-card" data-kind={kind}>
    {challenge
      ? <div className="invite-duel">
        <Fighter name={actor} avatar={avatar} elo={elo} label={`Elo ${actor}`} />
        <span className="invite-versus" aria-hidden="true">VS</span>
        <Fighter name={ownName ?? 'Ty'} avatar={ownAvatar} elo={ownElo} label="Twoje Elo" own />
      </div>
      : <UserAvatar className="invite-portrait" username={actor} avatar={avatar} alt="" />}
    <div className="invite-copy">
      <p className="invite-line"><strong className="invite-name">{actor}</strong>
        <span>{challenge ? 'wyzywa Cię na pojedynek' : 'chce dodać Cię do znajomych'}</span></p>
      {failed && <p className="invite-error" role="alert">Nie udało się. Spróbuj ponownie albo użyj dzwonka.</p>}
      <div className="invite-actions">
        <button type="button" className="invite-accept" disabled={busy} onClick={onAccept}>{challenge ? 'Przyjmij pojedynek' : 'Akceptuj'}</button>
        <button type="button" className="invite-reject" disabled={busy} onClick={onReject}>Odrzuć</button>
      </div>
    </div>
    {children}
  </div>;
}
