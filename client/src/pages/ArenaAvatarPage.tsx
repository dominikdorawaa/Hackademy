import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { ArenaLoader } from '../components/arena/ArenaLoader';
import { useAuth } from '../context/AuthContext';
import { getCurrentUser, saveAvatar as saveAccountAvatar } from '../services/userApi';
import { PROFILE_UPDATED } from '../lib/profile';
import { AvatarSprite } from '../components/arena/avatar/AvatarSprite';
import { useAvatarAtlas, useAvatarPortrait } from '../components/arena/avatar/useAvatarAtlas';
import { AVATAR_POSES, FINISHER_MOVES, fromAvatarConfig, HAIR_STYLES, HAT_STYLES, readAvatar, saveAvatar, toAvatarConfig, VICTORY_DANCES } from '../components/arena/avatar/avatarModel';
import type { Avatar } from '../components/arena/avatar/avatarModel';
import { COLOR_GROUPS, DANCE_OPTIONS, FINISHER_OPTIONS, HAIR_NAMES, HAT_NAMES, OUTFITS, POSE_NAMES } from '../components/arena/avatar/avatarOptions';
import { ColorChoices } from '../components/arena/avatar/ColorChoices';
import { AVATAR_ATLASES } from '../components/arena/avatar/fighters';
import { dancePreview, finisherPreview } from '../components/arena/avatar/movePreviews';
import './ArenaAvatarPage.css';
import './UserDashboardPage.css';

function PosePortrait({ avatar }: { avatar: Avatar }) {
  const portrait = useAvatarPortrait(toAvatarConfig(avatar));
  return portrait ? <img className="avatar-pose-image" src={portrait} alt="" /> : <span className="avatar-pose-image" aria-hidden="true" />;
}

export default function ArenaAvatarPage() {
  const [params] = useSearchParams();
  const fromProfile = params.get('from') === 'profile';
  const reducedMotion = useReducedMotion();
  const [avatar, setLook] = useState<Avatar>(readAvatar);
  const [saved, setSaved] = useState(() => JSON.stringify(readAvatar()));
  const [preview, setPreview] = useState<'front' | 'finisher' | 'dance'>('front');
  const atlas = useAvatarAtlas(avatar);
  const fighter = AVATAR_ATLASES[avatar.outfit];
  const dirty = saved !== JSON.stringify(avatar);
  const setAvatar = (change: Avatar | ((current: Avatar) => Avatar)) => { setPreview('front'); setLook(change); };
  const setMove = (patch: Partial<Pick<Avatar, 'finisher' | 'dance'>>, shown: 'finisher' | 'dance') => { setLook(current => ({ ...current, ...patch })); setPreview(shown); };
  const setColor = (key: keyof Avatar['colors'], value: string) => setAvatar(current => ({ ...current, colors: { ...current.colors, [key]: value } }));
  const { isAuthenticated, sessionKey } = useAuth();
  const sessionToken = isAuthenticated && sessionKey ? sessionKey : null;
  const [account, setAccount] = useState<{ sessionKey: string; status: 'ready' | 'error'; username: string | null } | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  useEffect(() => {
    if (!sessionToken) return;
    const controller = new AbortController();
    getCurrentUser({ sessionKey: sessionToken }, controller.signal)
      .then(response => { if (!response.ok) throw new Error('account'); return response.json(); })
      .then(user => {
        if (!user?.username) throw new Error('account');
        setAccount({ sessionKey: sessionToken, status: 'ready', username: user.username });
        const remote = fromAvatarConfig(user.avatar);
        if (remote) { setLook(remote); setSaved(JSON.stringify(remote)); } else setSaved('');
      })
      .catch(() => { if (!controller.signal.aborted) setAccount({ sessionKey: sessionToken, status: 'error', username: null }); });
    return () => controller.abort();
  }, [sessionToken]);
  const accountState = !sessionToken ? 'guest' : account?.sessionKey !== sessionToken ? 'loading' : account.status;
  const signedIn = accountState === 'ready';
  const blocked = accountState === 'loading' || accountState === 'error';
  const save = async () => {
    if (blocked) return;
    saveAvatar(avatar);
    if (signedIn) {
      setStatus('saving');
      try {
        const config = toAvatarConfig(avatar);
        const response = await saveAccountAvatar(config, { sessionKey });
        if (!response.ok) throw new Error('save failed');
        window.dispatchEvent(new CustomEvent(PROFILE_UPDATED, { detail: { username: account?.username, avatar: config } }));
      } catch {
        setStatus('error');
        return;
      }
    }
    setSaved(JSON.stringify(avatar));
    setStatus('idle');
  };
  const note = status === 'error' ? 'Nie udało się zapisać awatara na koncie. Spróbuj ponownie.'
    : accountState === 'loading' ? 'Wczytuję awatar z Twojego konta…'
    : accountState === 'error' ? 'Nie udało się wczytać awatara z konta. Odśwież stronę, żeby zapisać zmiany.'
    : signedIn && saved === '' ? 'Ten awatar nie jest jeszcze zapisany na Twoim koncie.'
    : dirty ? 'Masz niezapisane zmiany.'
    : signedIn ? 'Awatar jest zapisany na Twoim koncie i widoczny w profilu, rankingu i u znajomych.'
    : 'Awatar jest zapisany w tej przeglądarce. Zaloguj się, żeby zapisać go na koncie.';
  return <div className="user-dashboard avatar-page">
    <header className="avatar-heading">
      <div><Link to={fromProfile ? '/profile' : '/arena'}><ArrowLeft size={16} aria-hidden="true" />{fromProfile ? 'Wróć do profilu' : 'Wróć do Areny'}</Link><h1>Twój awatar</h1></div>
      <div className="avatar-actions">
        <button type="button" className="ud-btn ud-btn-solid" onClick={save} disabled={!dirty || blocked || status === 'saving'}>{status === 'saving' ? 'Zapisuję…' : dirty ? 'Zapisz awatar' : 'Zapisano'}</button>
      </div>
    </header>
    <div className="avatar-layout">
      <section className="avatar-preview" aria-label="Podgląd awatara">
        <div className="avatar-preview-heading"><h2>Podgląd</h2><span>{OUTFITS.find(outfit => outfit.id === avatar.outfit)?.name}</span></div>
        <div className="avatar-stage">
          {!atlas ? <ArenaLoader label="Przygotowuję postać" avatar={toAvatarConfig(avatar)} className="avatar-stage-loader" />
            : preview === 'finisher' ? <AvatarSprite key={`finisher-${avatar.finisher}`} atlas={atlas.atlas} atlasHeight={fighter.atlasHeight} frames={finisherPreview(avatar.finisher, reducedMotion)}
              frameTime={100} reducedMotion={reducedMotion} label={`Awatar, finisher: ${FINISHER_OPTIONS[avatar.finisher].name}`} />
            : preview === 'dance' ? <AvatarSprite key={`dance-${avatar.dance}`} atlas={atlas.atlas} atlasHeight={fighter.atlasHeight} frames={dancePreview(avatar.dance, reducedMotion)}
              frameTime={110} reducedMotion={reducedMotion} label={`Awatar, taniec zwycięstwa: ${DANCE_OPTIONS[avatar.dance].name}`} />
            : atlas.front ? <img className="avatar-front" src={atlas.front} alt="Awatar, widok z przodu" data-reduced-motion={reducedMotion} />
            : <AvatarSprite atlas={atlas.atlas} atlasHeight={fighter.atlasHeight} frames={[0]} reducedMotion={reducedMotion} label="Awatar w postawie" />}
        </div>
        <p className="avatar-note" role="status" aria-live="polite" data-state={status === 'error' || accountState === 'error' ? 'error' : status}>{note}</p>
      </section>
      <section className="avatar-controls" aria-label="Personalizacja awatara">
        <fieldset className="avatar-form" disabled={accountState === 'loading'} aria-busy={accountState === 'loading'}>
        <div className="avatar-section">
        <h2>Ubiór</h2>
        <fieldset><legend>Sylwetka</legend><div className="avatar-outfits">
          {OUTFITS.map(outfit => <label key={outfit.id} data-selected={avatar.outfit === outfit.id}>
            <input type="radio" name="avatar-outfit" value={outfit.id} checked={avatar.outfit === outfit.id} onChange={() => setAvatar(current => ({ ...current, outfit: outfit.id }))} />
            <span className="avatar-choice-mark" aria-hidden="true">{avatar.outfit === outfit.id && <Check size={14} />}</span>
            <strong>{outfit.name}</strong><small>{outfit.description}</small>
          </label>)}
        </div></fieldset>
        </div>
        <div className="avatar-section">
        <h2>Głowa</h2>
        <div className="avatar-head-options">
        {([['hair', 'Fryzura', HAIR_STYLES, HAIR_NAMES], ['hat', 'Czapka', HAT_STYLES, HAT_NAMES]] as const).map(([key, legend, options, names]) => <fieldset key={key}><legend>{legend}</legend><div className="avatar-styles">
          {options.map(option => <label key={option} data-selected={avatar[key] === option}>
            <input type="radio" name={`avatar-${key}-style`} value={option} checked={avatar[key] === option} onChange={() => setAvatar(current => ({ ...current, [key]: option }))} />{(names as Record<string, string>)[option]}
          </label>)}
        </div>
          {key === 'hair' && avatar.hat !== 'brak' && avatar.hair !== 'brak' && <p className="avatar-hint">Pod czapką fryzura jest schowana. Zdejmij czapkę, żeby ją zobaczyć.</p>}</fieldset>)}
        </div>
        </div>
        <div className="avatar-section color-choices-area">
        <h2>Kolory</h2>
        <div className="avatar-colors">
        {COLOR_GROUPS.map(group => <ColorChoices key={group.key} legend={group.legend} value={avatar.colors[group.key]} options={group.options}
          presets={group.presets} name={`avatar-${group.key}`} onChange={value => setColor(group.key, value)} />)}
        </div>
        </div>
        <div className="avatar-section">
        <h2>Walka</h2>
        <div className="avatar-head-options">
        <fieldset><legend>Finisher</legend><div className="avatar-outfits">
          {FINISHER_MOVES.map(move => <label key={move} data-selected={avatar.finisher === move}>
            <input type="radio" name="avatar-finisher" value={move} checked={avatar.finisher === move} onChange={() => setMove({ finisher: move }, 'finisher')} onClick={() => setPreview('finisher')} />
            <span className="avatar-choice-mark" aria-hidden="true">{avatar.finisher === move && <Check size={14} />}</span>
            <strong>{FINISHER_OPTIONS[move].name}</strong><small>{FINISHER_OPTIONS[move].description}</small>
          </label>)}
        </div></fieldset>
        <fieldset><legend>Taniec zwycięstwa</legend><div className="avatar-outfits">
          {VICTORY_DANCES.map(dance => <label key={dance} data-selected={avatar.dance === dance}>
            <input type="radio" name="avatar-dance" value={dance} checked={avatar.dance === dance} onChange={() => setMove({ dance }, 'dance')} onClick={() => setPreview('dance')} />
            <span className="avatar-choice-mark" aria-hidden="true">{avatar.dance === dance && <Check size={14} />}</span>
            <strong>{DANCE_OPTIONS[dance].name}</strong><small>{DANCE_OPTIONS[dance].description}</small>
          </label>)}
        </div></fieldset>
        </div>
        <p className="avatar-hint">Wybrany ruch od razu gra w podglądzie. Finisher kończy wygraną walkę, a taniec zobaczy rywal po Twojej wygranej.</p>
        </div>
        <div className="avatar-section">
        <h2>Ikona profilu</h2>
        <fieldset><legend>Poza na ikonie</legend><div className="avatar-poses">
          {AVATAR_POSES.map(pose => <label key={pose} data-selected={avatar.pose === pose}>
            <input type="radio" name="avatar-pose" value={pose} checked={avatar.pose === pose} onChange={() => setAvatar(current => ({ ...current, pose }))} />
            <PosePortrait avatar={{ ...avatar, pose }} />
            <span>{POSE_NAMES[pose]}</span>
          </label>)}
        </div>
        <p className="avatar-hint">Ikona pojawia się w profilu, nawigacji, rankingu, u znajomych i w Arenie.</p></fieldset>
        </div>
        </fieldset>
      </section>
    </div>
  </div>;
}
