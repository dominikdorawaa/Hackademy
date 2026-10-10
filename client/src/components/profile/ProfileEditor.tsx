import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { BadgeDto } from '../../types/api';
import { PROFILE_INTERESTS, PROFILE_UPDATED } from '../../lib/profile';
import type { ProfilePersonalization } from '../../lib/profile';
import { updateProfile } from '../../services/userApi';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import UserAvatar from '../UserAvatar';
import BadgeIcon from './BadgeIcon';

const variants = (current: string) => [current, ...Array.from({ length: 5 }, () => `avatar-${crypto.randomUUID()}`)];

export default function ProfileEditor({ username, initial, badges, onSaved, onClose, onUnauthorized }: {
  username: string; initial: ProfilePersonalization; badges: BadgeDto[];
  onSaved: (profile: ProfilePersonalization) => void; onClose: () => void; onUnauthorized: () => void;
}) {
  const { token } = useAuth();
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef<AbortController | null>(null);
  const [draft, setDraft] = useState(initial);
  const [avatars, setAvatars] = useState(() => variants(initial.avatarSeed));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [badgePage, setBadgePage] = useState(0);
  const earned = badges.filter(badge => badge.earned).sort((a, b) => (b.earnedAt ?? '').localeCompare(a.earnedAt ?? '') || a.id - b.id);
  const pages = Math.ceil(earned.length / 6);
  const invalid = draft.bio.length > 500;

  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    return () => {
      pending.current?.abort();
      element.close();
      document.body.style.overflow = overflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  function toggle<K extends 'interests' | 'featuredBadgeIds'>(key: K, value: ProfilePersonalization[K][number]) {
    setDraft(previous => {
      const values = previous[key] as (string | number)[];
      return { ...previous, [key]: values.includes(value) ? values.filter(item => item !== value) : [...values, value] };
    });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving || invalid) return;
    const controller = new AbortController();
    pending.current = controller;
    setSaving(true); setError('');
    try {
      const response = await updateProfile(draft, { Authorization: `Bearer ${token}` }, controller.signal);
      if (controller.signal.aborted) return;
      if (response.status === 401 || response.status === 403) { onUnauthorized(); return; }
      if (!response.ok) {
        setError(response.status === 400 ? 'Sprawdź dane profilu: opis do 500 znaków oraz wyłącznie zdobyte odznaki.' : 'Nie udało się zapisać profilu. Spróbuj ponownie.');
        return;
      }
      const profile = await response.json();
      if (controller.signal.aborted) return;
      onSaved(profile);
      window.dispatchEvent(new CustomEvent(PROFILE_UPDATED, { detail: { username, ...profile } }));
      onClose();
    } catch {
      if (!controller.signal.aborted) setError('Nie udało się połączyć z serwerem. Twoje zmiany pozostają w formularzu.');
    } finally {
      if (!controller.signal.aborted) setSaving(false);
    }
  }

  return <dialog ref={dialog} className="profile-editor" aria-labelledby={`${id}-title`}
    onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}
    onClick={event => { if (!saving && event.target === event.currentTarget) onClose(); }}>
    <header className="profile-editor-header">
      <h2 id={`${id}-title`}>Edytuj profil</h2>
      <Button variant="ghost" size="sm" disabled={saving} aria-label="Zamknij edycję profilu" onClick={onClose}><i className="fas fa-times" aria-hidden="true" /></Button>
    </header>
    <form onSubmit={event => void save(event)}>
      <fieldset disabled={saving} className="profile-editor-fields">
        <section className="profile-editor-avatar-section" aria-labelledby={`${id}-avatar`}>
          <div className="profile-editor-label-row"><h3 id={`${id}-avatar`}>Twój avatar</h3>
            <Button type="button" variant="outline" size="sm" onClick={() => setAvatars(variants(draft.avatarSeed))}>Losuj kolejne</Button></div>
          <div className="profile-avatar-options" role="radiogroup" aria-labelledby={`${id}-avatar`}>
            {avatars.map((seed, index) => <label key={seed} className="profile-avatar-option">
              <input type="radio" name={`${id}-avatar-choice`} checked={draft.avatarSeed === seed}
                aria-label={`Avatar ${index + 1}`} onChange={() => setDraft({ ...draft, avatarSeed: seed })} />
              <UserAvatar username={username} seed={seed} alt="" />
            </label>)}
          </div>
          <p className="profile-muted">Wybierz propozycję lub wylosuj nowe. Avatar zmieni się po zapisaniu.</p>
        </section>
        <div className="profile-editor-field"><label htmlFor={`${id}-bio`}>O mnie</label>
          <textarea id={`${id}-bio`} value={draft.bio} maxLength={500} rows={4} placeholder="Co Cię interesuje? Czego chcesz się nauczyć?"
            aria-describedby={`${id}-bio-count`} onChange={event => setDraft({ ...draft, bio: event.target.value })} />
          <span id={`${id}-bio-count`} className="profile-field-count">{draft.bio.length}/500</span></div>
        <section aria-labelledby={`${id}-interests`}><div className="profile-editor-label-row">
          <h3 id={`${id}-interests`}>Zainteresowania</h3><span className="profile-muted">{draft.interests.length}/5</span></div>
          <div className="profile-interest-options">{Object.entries(PROFILE_INTERESTS).map(([value, label]) =>
            <label key={value}><input type="checkbox" checked={draft.interests.includes(value)}
              disabled={!draft.interests.includes(value) && draft.interests.length >= 5}
              onChange={() => toggle('interests', value)} /><span>{label}</span></label>)}</div>
        </section>
        <section aria-labelledby={`${id}-badges`}><div className="profile-editor-label-row">
          <h3 id={`${id}-badges`}>Odznaki w gablocie</h3><span className="profile-muted">{draft.featuredBadgeIds.length}/3</span></div>
          <p className="profile-muted">Wybierz kolejno odznaki, które chcesz wyróżnić. Bez wyboru pokażemy ostatnio zdobyte.</p>
          {earned.length ? <>
            <div className="profile-badge-options">{earned.slice(badgePage * 6, badgePage * 6 + 6).map(badge =>
              <label key={badge.id}><input type="checkbox" checked={draft.featuredBadgeIds.includes(badge.id)}
                disabled={!draft.featuredBadgeIds.includes(badge.id) && draft.featuredBadgeIds.length >= 3}
                onChange={() => toggle('featuredBadgeIds', badge.id)} />
                <BadgeIcon badge={badge} /><span>{badge.name}</span>
                {draft.featuredBadgeIds.includes(badge.id) && <small>{draft.featuredBadgeIds.indexOf(badge.id) + 1}</small>}
              </label>)}</div>
            {pages > 1 && <div className="profile-editor-pagination">
              <Button type="button" size="sm" variant="outline" disabled={badgePage === 0} onClick={() => setBadgePage(badgePage - 1)}>Poprzednie odznaki</Button>
              <span>{badgePage + 1}/{pages}</span>
              <Button type="button" size="sm" variant="outline" disabled={badgePage + 1 >= pages} onClick={() => setBadgePage(badgePage + 1)}>Następne odznaki</Button>
            </div>}
          </> : <p className="profile-muted">Zdobyte odznaki pojawią się tutaj po pierwszych osiągnięciach.</p>}
        </section>
      </fieldset>
      <footer className="profile-editor-footer">
        {error && <p role="alert" className="profile-error">{error}</p>}
        <Button type="button" variant="ghost" disabled={saving} onClick={onClose}>Anuluj</Button>
        <Button type="submit" disabled={saving || invalid}>{saving ? 'Zapisywanie…' : 'Zapisz profil'}</Button>
      </footer>
    </form>
  </dialog>;
}
