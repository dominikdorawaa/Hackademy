import ProfileIcon from './ProfileIcon';
import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { BadgeDto } from '../../types/api';
import { PROFILE_INTERESTS, PROFILE_UPDATED } from '../../lib/profile';
import type { ProfilePersonalization } from '../../lib/profile';
import { updateProfile } from '../../services/userApi';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import BadgeIcon from './BadgeIcon';
import { useUsernameChange, validateUsername } from '../../hooks/useUsernameChange';
import { USERNAME_MAX, USERNAME_MIN } from '../../lib/username';

export default function ProfileEditor({ username, initial, badges, onSaved, onClose, onUnauthorized }: {
  username: string; initial: ProfilePersonalization; badges: BadgeDto[];
  onSaved: (profile: ProfilePersonalization, username: string) => void; onClose: () => void; onUnauthorized: () => void;
}) {
  const { sessionKey } = useAuth();
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const discardDialog = useRef<HTMLDialogElement>(null);
  const continueButton = useRef<HTMLButtonElement>(null);
  const discardButton = useRef<HTMLButtonElement>(null);
  const closeOrigin = useRef<HTMLElement | null>(null);
  const pending = useRef<AbortController | null>(null);
  const [original] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [badgePage, setBadgePage] = useState(0);
  const [savedName, setSavedName] = useState(username);
  const [name, setName] = useState(username);
  const [nameError, setNameError] = useState('');
  const { change: changeUsername } = useUsernameChange();
  const earned = badges.filter(badge => badge.earned).sort((a, b) => (b.earnedAt ?? '').localeCompare(a.earnedAt ?? '') || a.id - b.id);
  const pages = Math.ceil(earned.length / 6);
  const nameChanged = name.trim() !== savedName;
  const invalid = draft.bio.length > 500 || !!validateUsername(name);
  const profileChanged = draft.bio !== original.bio || draft.tagline !== original.tagline
    || JSON.stringify(draft.interests) !== JSON.stringify(original.interests)
    || JSON.stringify(draft.featuredBadgeIds) !== JSON.stringify(original.featuredBadgeIds);
  const changed = nameChanged || profileChanged;

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

  useEffect(() => {
    if (!confirmDiscard) return;
    const element = discardDialog.current!;
    const editor = dialog.current;
    element.showModal();
    continueButton.current?.focus();
    return () => {
      element.close();
      if (closeOrigin.current?.isConnected && editor?.open) closeOrigin.current.focus();
    };
  }, [confirmDiscard]);

  function requestClose() {
    if (saving || pending.current || confirmDiscard) return;
    if (!changed) { onClose(); return; }
    closeOrigin.current = document.activeElement as HTMLElement | null;
    setConfirmDiscard(true);
  }

  function toggle<K extends 'interests' | 'featuredBadgeIds'>(key: K, value: ProfilePersonalization[K][number]) {
    setDraft(previous => {
      const values = previous[key] as (string | number)[];
      return { ...previous, [key]: values.includes(value) ? values.filter(item => item !== value) : [...values, value] };
    });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving || pending.current || invalid || confirmDiscard) return;
    const controller = new AbortController();
    pending.current = controller;
    setSaving(true); setError(''); setNameError('');
    try {
      let current = savedName;
      if (nameChanged) {
        const renamed = await changeUsername(name);
        if (controller.signal.aborted || !renamed) return;
        if (!renamed.ok) {
          if (renamed.unauthorized) onUnauthorized(); else setNameError(renamed.error);
          return;
        }
        current = renamed.username;
        setSavedName(current);
        if (!profileChanged) { onSaved(original, current); onClose(); return; }
      }
      const response = await updateProfile(draft, { sessionKey }, controller.signal);
      if (controller.signal.aborted) return;
      if (response.status === 401) { onUnauthorized(); return; }
      if (!response.ok) {
        setError(response.status === 400 ? 'Sprawdź dane profilu: opis do 500 znaków oraz wyłącznie zdobyte odznaki.' : 'Nie udało się zapisać profilu. Spróbuj ponownie.');
        return;
      }
      const profile = await response.json();
      if (controller.signal.aborted) return;
      onSaved(profile, current);
      window.dispatchEvent(new CustomEvent(PROFILE_UPDATED, { detail: { username: current, ...profile } }));
      onClose();
    } catch {
      if (!controller.signal.aborted) setError('Nie udało się połączyć z serwerem. Twoje zmiany pozostają w formularzu.');
    } finally {
      if (pending.current === controller) pending.current = null;
      if (!controller.signal.aborted) setSaving(false);
    }
  }

  return <dialog ref={dialog} className="profile-editor" aria-labelledby={`${id}-title`}
    onCancel={event => { event.preventDefault(); requestClose(); }}>
    <header className="profile-editor-header">
      <h2 id={`${id}-title`}>Edytuj profil</h2>
      <Button variant="ghost" size="sm" disabled={saving} aria-label="Zamknij edycję profilu" onClick={requestClose}><ProfileIcon kind="close" weight="bold" /></Button>
    </header>
    <form onSubmit={event => void save(event)}>
      <fieldset disabled={saving} className="profile-editor-fields">
        <div className="profile-editor-field"><label htmlFor={`${id}-username`}>Nazwa użytkownika</label>
          <input id={`${id}-username`} autoComplete="username" value={name} required minLength={USERNAME_MIN} maxLength={USERNAME_MAX}
            aria-invalid={!!nameError} aria-describedby={`${id}-username-help`}
            onChange={event => { setName(event.target.value); setNameError(''); }} />
          <span id={`${id}-username-help`} className={nameError ? 'profile-error' : 'profile-muted'} role={nameError ? 'alert' : undefined}>
            {nameError || `Tak zobaczą Cię inni użytkownicy. Od ${USERNAME_MIN} do ${USERNAME_MAX} znaków: litery, cyfry, _ i -.`}</span></div>
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
          <p className="profile-muted">Wybierz od zera do trzech odznak w kolejności wyświetlania. Brak wybranych odznak ukrywa gablotę.</p>
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
        <Button type="button" variant="ghost" disabled={saving} onClick={requestClose}>Anuluj</Button>
        <Button type="submit" disabled={saving || invalid}>{saving ? 'Zapisywanie…' : 'Zapisz profil'}</Button>
      </footer>
    </form>
    {confirmDiscard && <dialog ref={discardDialog} className="profile-discard-confirmation" role="alertdialog"
      aria-labelledby={`${id}-discard-title`} aria-describedby={`${id}-discard-description`}
      onKeyDown={event => {
        if (event.key !== 'Tab') return;
        if (event.shiftKey && document.activeElement === continueButton.current) {
          event.preventDefault(); discardButton.current?.focus();
        } else if (!event.shiftKey && document.activeElement === discardButton.current) {
          event.preventDefault(); continueButton.current?.focus();
        }
      }}
      onCancel={event => { event.preventDefault(); event.stopPropagation(); setConfirmDiscard(false); }}>
      <h2 id={`${id}-discard-title`}>Niezapisane zmiany</h2>
      <p id={`${id}-discard-description`}>Jeśli zamkniesz edytor, wprowadzone zmiany zostaną odrzucone.</p>
      <div className="profile-discard-actions">
        <Button type="button" ref={continueButton} onClick={() => setConfirmDiscard(false)}>Kontynuuj edycję</Button>
        <Button type="button" ref={discardButton} variant="outline" onClick={onClose}>Odrzuć zmiany</Button>
      </div>
    </dialog>}
  </dialog>;
}
